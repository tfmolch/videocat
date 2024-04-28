const rp = require('request-promise');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const Filehound = require('filehound');

var dataPaths = [
    '/mnt/RAID5/Video/DVD/',
    '/mnt/RAID5/Video/BD/'
];

function getEntireCatalogue(){
    return new Promise( async function(resolve, reject) {
        var options = {
            uri: "http://192.168.1.27:19207/videocat/_search",
            method: 'GET',
            json: true,
            body: {
              "query": {
                "match_all": {}
              },
              "sort" : [
                { "title.keyword" : "asc" }
              ],
              "_source":["title","year","director","path","mediatype"],
              "size": 10000,
              "from":0
            }
          };
          rp(options).then(function(body){
            //console.log(body)
            resolve(body.hits.hits)
          }).catch(function (err) {
            reject(err);
          }); 
    })
};

async function deleteIdFromIndex(movieId) {
    return new Promise( async function(resolve, reject) {
      var deleteoptions = {
          uri: "http://192.168.1.27:19207/videocat/_doc/"+movieId,
          method: 'DELETE'
      };
      rp(deleteoptions).then(function(body) {
        //console.log(body);
        resolve(body);
      }).catch(function (err) {
        console.log(err);
        reject(err);
      });
    });
};

async function scanDirectory(pathToScan) {
    return new Promise( async function(resolve, reject) {
        fs.readdir(pathToScan, (err, list) => {
            list = list.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item)).map(item => path.join(pathToScan,item));
            resolve(list);
        });
    });
};

async function getAllItemsInDataPaths(){
    return new Promise( async function(resolve, reject) {
        var pathsTodo = dataPaths.length;
        var pathsDone = 0;
        var allItemsInDataPaths = [];
        dataPaths.forEach(function(dataPath){
            scanDirectory(dataPath).then(function(dataPathContents){
                allItemsInDataPaths = allItemsInDataPaths.concat(dataPathContents);
                pathsDone+=1;
                if (pathsTodo===pathsDone){
                    resolve(allItemsInDataPaths);
                };
            });
        });
    });
};

async function checkItemByPath(folderpath){
    return new Promise( async function(resolve, reject) {

        var options = {
            uri: "http://192.168.1.27:19207/videocat/_search",
            json: true,
            method: 'POST',
            body: {
                "_source":["title","year","director","path","mediatype"],
                "query": {
                "bool": {
                    "must": {
                    "match": {
                        "path.keyword": folderpath
                    }
                    }
                }
                }
            }
        };
        rp(options).then(function(body) {
            var count = body.hits.total.value;
            if ((count === 0)||(count === 1)){
                resolve({count:count});
            } else {
                var ids = [];
                body.hits.hits.forEach(function(hit){
                    ids.push(hit._id);
                });
                resolve({count:count,ids:ids});
            };
        }).catch(function(err){
            reject(err);
        });
    });
};

async function sendToRelay(data){
    return new Promise( async function(resolve, reject) {
  
        var postoptions = {
            uri: "https://relay.abg.thomasfelder.com/",
            method: 'POST',
            json: true,
            body: data
        };
        rp(postoptions).then(function (body) {
          resolve(body);
        }).catch(function (err) {
          reject(err);
        })
      })
};
  
async function addPathToIndex(folderpath){
    return new Promise( async function(resolve, reject) {
        var mediatype;
        if (folderpath.includes('/Video/BD/')) {
            mediatype = 'BD';
        } else if (folderpath.includes('/Video/DVD/')) {
            mediatype = 'DVD';
        };
        var options = {
            uri: "http://192.168.1.27:19207/videocat/_doc",
            json: true,
            method: 'POST',
            body: {
              "title":path.basename(folderpath),
              "path":folderpath,
              "added":moment(),
              "mediatype": mediatype,
              "rating": 0,
              "playcount": 0
            },
        };
        rp(options).then(function (body) {
            console.log(mediatype+" "+path.basename(folderpath)+" added to index.");
            sendToRelay({channel:'catalogue',action:'Added',es:body,data:options.body,timestamp:moment()});
            resolve(body);
        }).catch(function (err) {
            console.log(err);
            reject(err);
        });
    });
};

async function checkAllPathsAgainstIndex(pathsToCheck){
    return new Promise( async function(resolve, reject) {
            var pathsToDo = pathsToCheck.length;
            var pathsDone = 0;
            pathsToCheck.forEach(function(pathToCheck){
                checkItemByPath(pathToCheck).then(function(result){
                    if (result.count === 0){
                        console.log("\x1b[33m"+pathToCheck+"\x1b[0m returned \x1b[33m"+result.count+"\x1b[0m hits in index...");

                        addPathToIndex(pathToCheck).then(function(){
                            pathsDone+=1;
                            if (pathsTodo===pathsDone){
                                console.log("all paths checked")
                            };
                        });
                    } else if (result.count === 1) {
                        //console.log("\x1b[32m"+pathToCheck+"\x1b[0m returned \x1b[32m"+result.count+"\x1b[0m hits in index...");
                        pathsDone+=1;
                        if (pathsTodo===pathsDone){
                            console.log("all paths checked")
                        };
                    } else {
                        result.ids.pop();
                        var resultsToDelete = result.ids;

                        console.log("\x1b[31m"+pathToCheck+"\x1b[0m returned \x1b[31m"+result.count+"\x1b[0m hits in index...");

                        var deletionsTodo = resultsToDelete.length;
                        var deletionsDone = 0;

                        console.log(deletionsTodo+" to delete: ",resultsToDelete);

                        resultsToDelete.forEach(function(idToDelete){
                            deleteIdFromIndex(idToDelete).then(function(){
                                deletionsDone+=1;
                                if (deletionsTodo === deletionsDone){
                                    pathsDone+=1;
                                    if (pathsToDo===pathsDone){
                                        console.log("all paths checked")
                                        resolve();
                                    };
                                }
                            });
                        });

                    }
                }).catch(function(){

                })
            });
    });
};

async function fileExists(pathToCheck){
    fs.stat(pathToCheck, function(err, stat) {
        if (err == null) {
            return true;
        } else if (err.code === 'ENOENT') {
            return false;
        } else {
            console.log('Stat error: ', err.code);
            return false;
        }
    });
}

async function checkIndexedItemsAgainstPaths(){
    return new Promise( async function(resolve, reject) {
        getEntireCatalogue().then(function(movies){
            var todo = movies.length;
            var done = 0;
            console.log(todo+" paths to check...");
            movies.forEach(function(movie){
                if (fileExists(movie._source.path)){
                    done+=1;
                    if (todo===done){
                        console.log("all paths checked");
                        resolve();
                    };
                } else {
                    console.log("Path \x1b[36m"+movie._source.path+"\x1b[0m does not exist, removing \x1b[33m"+movie._id+"\x1b[0m from index...")
                    deleteIdFromIndex(movie._id).then(function(){
                        done+=1;
                        if (todo===done){
                            console.log("all paths checked");
                            resolve();
        
                        };
                    }).catch(function(err){
                        console.log(err);
                        done+=1;
                        if (todo===done){
                            console.log("all paths checked");
                            resolve();
                        };
                    })
                }
            });
        })
        
    });
};

checkIndexedItemsAgainstPaths().then(function(){
    getAllItemsInDataPaths().then(function(allItemsInDataPaths){
        console.log(allItemsInDataPaths.length+" items in data paths...");
        checkAllPathsAgainstIndex(allItemsInDataPaths).then(function(){
            console.log("DONE");
        })
    });
});