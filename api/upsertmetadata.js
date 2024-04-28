const rp = require('request-promise');
const moment = require('moment');

async function getMoreTmdbDetails(id) {
  return new Promise( async function(resolve, reject) {
    var options = {
        uri: "https://api.themoviedb.org/3/movie/"+id+"?api_key="+process.env.TMDB_APIKEY+"&language=en-US",
        json: true,
        method: 'GET'
    };

    rp(options).then(function(body) {
      resolve(body);
    }).catch(function(error){
      reject(error);
    })

  });
};
async function resolveTmdbDetails(item) {
  return new Promise( async function(resolve, reject) {
    var options = {
        uri: "https://api.themoviedb.org/3/movie/"+item.id+"/credits?api_key="+process.env.TMDB_APIKEY+"&language=en-US",
        json: true,
        method: 'GET'
    };

    rp(options).then(async function(body) {
      body.director = body.crew[body.crew.findIndex(x => (x.job == 'Director'))] || body.cast[body.cast.findIndex(x => (x.known_for_department == 'Directing'))];
      body.production = await getMoreTmdbDetails(item.id);
      resolve(body);
    }).catch(function(error){
      reject(error);
    })

  });
};
async function getTmdbMatch(item) {
  return new Promise( async function(resolve, reject) {
    var options = {
        uri: "https://api.themoviedb.org/3/search/movie?api_key="+process.env.TMDB_APIKEY+"&language=en-US&query="+item.title+"&page=1&include_adult=false",
        json: true,
        method: 'GET'
    };
    if (item.year) {
      options.url += ('&year='+item.year);
    }
    rp(options).then(async function(body) {
      if (body.results.length){
        var todo = body.results.length;
        var done = 0;
        var hit;
        body.results.forEach(function(result,index){


          if (result.release_date) {
            var resultyear = moment(result.release_date,'YYYY-mm-dd').format('YYYY').toString();

            //console.log(result.original_title,resultyear,item.year,item.title);

            if (resultyear == item.year){
              if (result.original_title == item.title){
                resolveTmdbDetails(result).then(function(details){
                  result.details = details;
                  hit = result;
                  done +=1;
                  if (todo === done){
                    if (hit){
                      resolve(hit);
                    } else {
                      reject("no results for "+item.title);
                    }
                  }
                });
              } else {
                done +=1;
                if (todo === done){
                  if (hit){
                    resolve(hit);
                  } else {
                    reject("no results for "+item.title);
                  }
                }
              }

            } else {
              done +=1;
              if (todo === done){
                if (hit){
                  resolve(hit);
                } else {
                  reject("no results for "+item.title);
                }
              }
            }
          } else {
            done +=1;
            if (todo === done){
              if (hit){
                resolve(hit);
              } else {
                reject("no results for "+item.title);
              }
            }
          };
        })
      } else {
        reject("no results for "+item.title);
      }

    }).catch(function(error){
      reject(error);
    })

  });
};


async function fetchCatalogue(searchterm) {
  return new Promise( async function(resolve, reject) {

       var options = {
           uri: "http://10.0.0.27:19207/videocat/_search",
           json: true,
           body: {
             "size": 1000,
             "sort": { "title.keyword" : {"order" : "asc"}},
         }
       };
       if (searchterm) {
         options.body.query = {
           "multi_match": {
             "query": searchterm,
             "type": "phrase_prefix"
           }
         }
       };

       rp(options)
           .then(function (body) {
             resolve(body.hits.hits);
           }).catch(function (err) {
             reject(err);
           });
         })
};

function upsertData(data,movie){
  return new Promise( async function(resolve, reject) {

  var updateoptions = {
      uri: "http://10.0.0.27:19207/videocat/_update/"+movie._id+"?retry_on_conflict=6",
      json: true,
      method: 'POST',
      body: {
        "doc": {
          cast: data.cast,
          crew: data.crew,
          release_date: moment(data.metadata.release_date,'YYYY-mm-dd'),
          production: data.metadata.details.production,
          summary: data.metadata.overview
        }
      }
  };

  if ((updateoptions.body.doc.cast.length)&&(updateoptions.body.doc.crew.length)&&(data.metadata.overview.length)){
    console.log(updateoptions.body.doc.cast.length+" cast added; "+updateoptions.body.doc.crew.length+" added.");

      rp(updateoptions).then(function (body) {
        resolve(body);
      }).catch(function (err) {
        reject(err);
      })
  }
})

};

fetchCatalogue().then(async function(movies){
  movies.forEach(function(movie){
    if ((movie._source.title)&&(movie._source.year)&&(movie._source.title.substr(movie._source.title.length - 5) !== 'BONUS')&&(!movie._source.crew)){
      getTmdbMatch(movie._source).then(function(metadata){
        var crewdone = false;
        var castdone = false;

        var crewList = [];
        var crewtodo = metadata.details.crew.length;
        var crewdone = 0;

        var castList = [];
        var casttodo = metadata.details.cast.length;
        var castdone = 0;
        function upsert(){
          upsertData({cast:castList,crew:crewList,metadata:metadata},movie).then(function(result){
            console.log(result)
          }).catch(function(err){
            console.log(err)
          })
        }

        metadata.details.crew.forEach(function(person){
          var crewListIndex =  crewList.findIndex(x => (x.name == person.name));
          if (crewListIndex === -1) {
            crewList.push({name:person.name,roles:[person.known_for_department]})
            crewdone+=1;
            if (crewdone === crewtodo){
              crewdone = true;
              if ((crewdone === true)&&(castdone === true)){
                upsert();
              }
            }
          } else {
            var roleIndex = crewList[crewListIndex].roles.indexOf(person.known_for_department);
            if (roleIndex === -1){
              crewList[crewListIndex].roles.push(person.known_for_department);
            };
            crewdone+=1;
            if (crewdone === crewtodo){
              crewdone = true;
              if ((crewdone === true)&&(castdone === true)){
                upsert();

              }
            }
          }
        })

        metadata.details.cast.forEach(function(person){
          var castListIndex =  castList.findIndex(x => (x.name == person.name));
          if (castListIndex === -1) {
            castList.push({name:person.name,roles:[person.known_for_department]})
            castdone+=1;
            if (castdone === casttodo){
              castdone = true;
              if ((crewdone === true)&&(castdone === true)){
                upsert();
              }
            }
          } else {
            var roleIndex = castList[castListIndex].roles.indexOf(person.known_for_department);
            if (roleIndex === -1){
              castList[castListIndex].roles.push(person.known_for_department);
            };
            castdone+=1;
            if (castdone === casttodo){
              castdone = true;
              if ((crewdone === true)&&(castdone === true)){
                upsert();
              }
            }
          }
        })

      }).catch(function(err){
        console.log(err+' for '+movie._source.title)
      })
    }
  })
});
