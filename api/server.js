const rp = require('request-promise');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const junk = require('junk');
const chokidar = require('chokidar');
const glob = require('glob');
const util = require('util');
const JSON5 = require('json5');
const exec = require('child_process').exec;
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const fsUtils = require("nodejs-fs-utils");
const wol = require('wol');
const checkDiskSpace = require('check-disk-space');
const express = require("express");
const apicache = require('apicache');
const app = express();

require('dotenv').config()

let cache = apicache.middleware;

var http = require("http")

var proxyFiles = [];
var cacheMs = 7000;

//app.use(cache('24 hours'));

const options = {
  index: 'index.html'
};
const PORT = 3445;

app.use('/', express.static('../public', options));
app.use('/js', express.static(__dirname + '/node_modules'));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(bodyParser.json({ limit: '50mb', extended: false }));

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const server = app.listen(PORT, '0.0.0.0', function () {
  console.log(`\nListening on port 0.0.0.0:${PORT}\n`);
});

var languageLookupList;
fs.readFile(path.join(__dirname, 'language-codes-full.json'), 'utf8', function (err, data) {
  if (err) throw err;
  languageLookupList = JSON.parse(data);
});

var machines = [
  {
    name: 'go',
    ip: '192.168.1.29',
    hw: '00:13:3b:aa:7b:27',
    capabilities: ['DVD', 'BD'],
    username: 'tfelder',
    system: 'linux',
    opencmd: 'nautilus',
    display: 0
  },
  {
    name: 'MDD',
    ip: '192.168.1.223',
    hw: '00:03:93:da:97:84',
    capabilities: ['DVD'],
    username: 'tfelder',
    system: 'osx',
    opencmd: 'open',
    display: 0
  },
  {
    name: 'MDD2',
    ip: '192.168.1.223',
    hw: '00:03:93:da:97:84',
    capabilities: ['DVD'],
    username: 'tfelder',
    system: 'osx',
    opencmd: 'open',
    display: 0
  },
  {
    name: 'POWER5',
    ip: '192.168.1.227',
    hw: '00:14:51:65:51:84',
    capabilities: ['DVD', 'BD'],
    username: 'tfelder',
    system: 'osx',
    opencmd: 'open',
    display: 0
  },
  {
    name: 'thirteen',
    ip: '192.168.1.13',
    hw: '00:50:b6:ff:ed:9d',
    capabilities: ['DVD', 'BD'],
    username: 'tfelder',
    system: 'osx',
    opencmd: 'open',
    display: 0
  },
  {
    name: 'Mac Pro',
    ip: '192.168.1.9',
    hw: '00:3e:e1:ce:b5:9a',
    capabilities: ['DVD', 'BD'],
    username: 'tfelder',
    system: 'osx',
    opencmd: 'open',
    display: 0,
    mount: '/System/Volumes/Data/Network/Servers/192.168.1.2/mnt/RAID5'
  },
  //  {
  //    name: 'twentyseven',
  //    ip: '192.168.1.28',
  //    hw:'C4:2C:03:2B:79:71',
  //    capabilities: ['DVD','BD'],
  //    username: 'tfelder',
  //    system: 'linux',
  //    //opencmd: 'kfmclient exec',
  //    opencmd: 'nautilus',
  //    display: 1
  //  },
  {
    name: 'thirteen Debian',
    ip: '192.168.1.13',
    hw: '68:5b:35:cf:06:66',
    capabilities: ['DVD', 'BD'],
    username: 'tfelder',
    system: 'linux',
    opencmd: 'kfmclient exec',
    opencmd: 'nautilus',
    display: 1
  },
];

var videoPaths = [
  '/mnt/RAID5/Video/DVD/',
  '/mnt/RAID5/Video/BD/'
];

var storageMounts = [
  '/mnt/RAID5'
]

var frontendUpdate = false;

var activeTasks = [];
var taskData = { name: 'catalogue', url: 'https://catalogue.abg.thomasfelder.com/tasks/active' };

function registerTasksEndpoint() {
  return new Promise(function (resolve, reject) {
    rp('https://relay.abg.thomasfelder.com/tasks/registry').then(function (body) {
      var parsed = JSON5.parse(body);
      var registryIndex = parsed.sources.findIndex(x => (x.name === taskData.name));
      console.log(registryIndex)

      if (registryIndex === -1) {
        var postoptions = {
          uri: "https://relay.abg.thomasfelder.com/tasks/register",
          method: 'POST',
          json: true,
          body: taskData
        };
        rp(postoptions).then(function (body) {
          resolve("Registered at relay.");
        }).catch(function (err) {
          reject("Registering at relay failed.", err);
        })
      } else {
        resolve("Already registered at relay.");
      }
    }).catch(function (err) {
      reject("Retrieving relay registry failed.", err);
    })
  });
};

function removeSpecials(str) {
  var lower = str.toLowerCase();
  var upper = str.toUpperCase();

  var res = "";
  for (var i = 0; i < lower.length; ++i) {
    if (lower[i] != upper[i] || lower[i].trim() === '' || (!isNaN(+str[i]))) {
      res += str[i];
    }
  }
  return res;
}

registerTasksEndpoint().then(function (result) {
  console.log(result);
}).catch(function (err) {
  console.log(err);
});

async function sendToRelay(data) {
  return new Promise(async function (resolve, reject) {

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

function formatBytes(bytes, decimals) {
  if (bytes == 0) return '0 Bytes';
  var k = 1000,
    dm = decimals || 2,
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getStorageStats() {
  return new Promise(async function (resolve, reject) {
    var todo = storageMounts.length;
    var done = 0;
    var total = 0;
    var totalFree = 0;
    var totalUsed = 0;
    var stats = [];
    storageMounts.forEach(function (mount) {
      checkDiskSpace(mount).then((diskSpace) => {
        total += diskSpace.size;
        totalFree += diskSpace.free;
        totalUsed += (diskSpace.size - diskSpace.free);
        stats.push({ mount: mount, name: path.basename(mount), free: diskSpace.free, total: diskSpace.size, free_human: formatBytes(diskSpace.free, 2), percentage_free: ((diskSpace.free / diskSpace.size) * 100).toFixed(2), percentage_used: (((diskSpace.size - diskSpace.free) / diskSpace.size) * 100).toFixed(2) });

        done += 1;
        if (todo === done) {
          resolve({
            disks: stats,
            total: total,
            total_human: formatBytes(total, 2),
            total_used: totalUsed,
            total_used_human: formatBytes(totalUsed, 2),
            free: totalFree,
            free_human: formatBytes(totalFree, 2),
            percentage_free: ((totalFree / total) * 100).toFixed(2),
            percentage_used: (((total - totalFree) / total) * 100).toFixed(2),
          })
        };
      })
    })
  })
};

function upsertData(data, esid, currenttitle) {
  return new Promise(async function (resolve, reject) {
    var updateoptions = {
      uri: process.env.ELASTICSEARCH+"/_update/" + esid + "?retry_on_conflict=5&refresh=true",
      json: true,
      method: 'POST',
      body: {
        "doc": {
          cast: data.cast,
          crew: data.crew,
          release_date: moment(data.metadata.release_date, 'YYYY-mm-dd'),
          production: data.metadata.details.production,
          summary: data.metadata.overview,
          director: data.metadata.details.director.name,
          year: Number(moment(data.metadata.release_date, 'YYYY-mm-DD').format('YYYY'))
        }
      }
    };


    if (data.metadata.details.production) {
      updateoptions.body.doc.production = data.metadata.details.production;
      if (data.metadata.details.production.production_companies.length) {
        updateoptions.body.doc.productioncompany = data.metadata.details.production.production_companies[0].name;
      }
    };
    rp(updateoptions).then(function (body) {
      resolve(updateoptions.body.doc);
    }).catch(function (err) {
      reject(err);
    })
  })
};

function changeMovieTitle(oldPath, newPath, esid, year) {
  return new Promise(async function (resolve, reject) {
    var oldFolderName = path.basename(oldPath);
    var newFolderName = path.basename(newPath);
    console.log(oldPath + " --> " + newPath);
    console.log(oldFolderName + " --> " + newFolderName);
    //rename folder

    fs.access(path.resolve(oldPath), fs.constants.F_OK, (err) => {
      if (err) {
        fs.access(path.resolve(newPath), fs.constants.F_OK, (err) => {
          if (err) {
            console.log("Movie neither in old nor in new path!")
            reject("Movie neither in old nor in new path!");
          } else {
            console.log("Movie already in new folder path.")
            var updateoptions = {
              uri: process.env.ELASTICSEARCH+"/_update/" + esid + "?retry_on_conflict=5&refresh=true",
              json: true,
              method: 'POST',
              body: {
                "doc": {
                  title: newFolderName,
                  path: newPath
                }
              }
            };
            rp(updateoptions).then(function (body) {
              resolve(updateoptions.body.doc);
            }).catch(function (err) {
              console.log(err);
              reject(err);
            })
          }
        })
      } else {
        fs.rename(oldPath, newPath, function (err) {
          if (err) {
            console.log(err)
            newPath = newPath + " (" + year + ")";
            fs.rename(oldPath, newPath, function (err) {
              if (err) {
                console.log(err)
                newPath = newPath + " (" + year + ")";
                reject({ message: "Folder with same name exists in directory." + newPath, error: err });
              } else {
                console.log("Successfully renamed the directory.")
                var updateoptions = {
                  uri: process.env.ELASTICSEARCH+"/_update/" + esid + "?retry_on_conflict=5&refresh=true",
                  json: true,
                  method: 'POST',
                  body: {
                    "doc": {
                      title: path.basename(newPath),
                      path: newPath
                    }
                  }
                };
                console.log(updateoptions);
                rp(updateoptions).then(function (body) {
                  resolve(updateoptions.body.doc);
                }).catch(function (err) {
                  console.log(err);
                  reject(err);
                });
              }
            })
          } else {
            console.log("Successfully renamed the directory.")
            var updateoptions = {
              uri: process.env.ELASTICSEARCH+"/_update/" + esid + "?retry_on_conflict=5&refresh=true",
              json: true,
              method: 'POST',
              body: {
                "doc": {
                  title: newFolderName,
                  path: newPath
                }
              }
            };
            console.log(updateoptions);
            rp(updateoptions).then(function (body) {
              resolve(updateoptions.body.doc);
            }).catch(function (err) {
              console.log(err);
              reject(err);
            });
          }
        })
      }
    })

  })
}


async function processTmdbCastAndCrew(metadata, esid) {
  return new Promise(async function (resolve, reject) {
    var crewdone = false;
    var castdone = false;

    var crewList = [];
    var crewtodo = metadata.details.crew.length;
    var crewdone = 0;

    var castList = [];
    var casttodo = metadata.details.cast.length;
    var castdone = 0;
    function complete() {
      resolve({ cast: castList, crew: crewList });
    }

    console.log(casttodo + " cast to-do", crewtodo + " crew to-do")

    if (crewtodo > 0) {
      metadata.details.crew.forEach(function (person) {
        var crewListIndex = crewList.findIndex(x => (x.name == person.name));
        if (crewListIndex === -1) {
          crewList.push({ name: person.name, roles: [person.known_for_department] })
          crewdone += 1;
          if (crewdone === crewtodo) {
            crewdone = true;
            if ((crewdone === true) && (castdone === true)) {
              complete();
            }
          }
        } else {
          var roleIndex = crewList[crewListIndex].roles.indexOf(person.known_for_department);
          if (roleIndex === -1) {
            crewList[crewListIndex].roles.push(person.known_for_department);
          };
          crewdone += 1;
          if (crewdone === crewtodo) {
            crewdone = true;
            if ((crewdone === true) && (castdone === true)) {
              complete();

            }
          }
        }
      })
    } else {
      crewdone = true;
      if ((crewdone === true) && (castdone === true)) {
        complete();
      }
    };


    if (casttodo > 0) {
      metadata.details.cast.forEach(function (person) {
        var castListIndex = castList.findIndex(x => (x.name == person.name));
        if (castListIndex === -1) {
          castList.push({ name: person.name, roles: [person.known_for_department] })
          castdone += 1;
          if (castdone === casttodo) {
            castdone = true;
            if ((crewdone === true) && (castdone === true)) {
              complete();
            }
          }
        } else {
          var roleIndex = castList[castListIndex].roles.indexOf(person.known_for_department);
          if (roleIndex === -1) {
            castList[castListIndex].roles.push(person.known_for_department);
          };
          castdone += 1;
          if (castdone === casttodo) {
            castdone = true;
            if ((crewdone === true) && (castdone === true)) {
              complete();
            }
          }
        }
      })
    } else {
      castdone = true;
      if ((crewdone === true) && (castdone === true)) {
        complete();
      }
    }

  }
  )
};

async function getBdMetadata(bdpath) {
  return new Promise(async function (resolve, reject) {

    var child = spawn('/usr/local/bin/bluray_info', ['-x', '-a', '-m', '-j', path.join(bdpath)]);
    var scriptOutput = "";
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', function (data) {
      data = data.toString();
      scriptOutput += data;
    });

    //child.stderr.setEncoding('utf8');
    child.stderr.on('data', function (data) {
      //console.log("ERROR: "+data);
    });

    child.on('close', async function (code) {
      //console.log(scriptOutput)
      var json = JSON5.parse(scriptOutput);
      if (json.bluray) {
        json.bluray.path = bdpath;
        json.titles[0].audio.forEach(function (audiotrack, index) {
          var langIndex = languageLookupList.findIndex(x => ((x['alpha3-b'] == audiotrack.language) || (x['alpha3-t'] == audiotrack.language)));
          if (langIndex) {
            audiotrack.language_en = languageLookupList[langIndex]['English'];
          };
        });
        json.titles[0].subtitles.forEach(function (subtitletrack, index) {
          var langIndex = languageLookupList.findIndex(x => ((x['alpha3-b'] == subtitletrack.language) || (x['alpha3-t'] == subtitletrack.language)));
          if (langIndex) {
            subtitletrack.language_en = languageLookupList[langIndex]['English'];
          };
        });
        fsUtils.fsize(bdpath, {
          skipErrors: true
        }, function (err, size) {
          // callback code
          if (err) {
            console.log(err);
            resolve(json);
          } else {
            json.storage_size = size;
            json.storage_size_human = formatBytes(size, 3);
            resolve(json);
          }
        });
      } else {
        reject();
      }
    });
  });
};


async function getIndexStats(metric) {
  return new Promise(async function (resolve, reject) {
    var path;
    if (metric) {
      path = "/videocat/_stats/" + metric
    } else {
      path = "/videocat/_stats"
    }
    var options = {
      uri: "http://192.168.1.27:19207" + path,
      method: 'GET',
      json: true
    };
    rp(options).then(function (body) {
      resolve(body);
    }).catch(function (err) {
      reject(err);
    })
  })
};

async function movieByTitleAndYear(title, year) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: process.env.ELASTICSEARCH+"/_search",
      method: 'GET',
      json: true,
      body: {
        "query": {
          "bool": {
            "must": [
              {
                "match_phrase": {
                  "title": title
                }
              },
              {
                "match_phrase": {
                  "year": year
                }
              }
            ]
          }
        }
      }
    };
    rp(options).then(function (body) {
      //console.log(body)
      if (body.hits.hits[0]) {
        resolve(body.hits.hits[0])
      } else {
        reject();
      }
    }).catch(function (err) {
      reject(err);
    })
  })
};

async function getUnplayedCount() {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: process.env.ELASTICSEARCH+"/_search",
      method: 'POST',
      json: true,
      body: {
        "query": {
          "bool": {
            "must": [
              {
                "bool": {
                  "must_not": {
                    "exists": {
                      "field": "lastplayed"
                    }
                  }
                }
              },
              {
                "bool": {
                  "must_not": {
                    "match": {
                      "title": {
                        "query": "BONUS"
                      }
                    }
                  }
                }
              },
              {
                "bool": {
                  "must_not": {
                    "term": {
                      "damaged": true
                    }
                  }
                }
              }
            ]
          }
        },
        "size": 0,
        "track_total_hits": true
      }
    };
    rp(options).then(function (body) {
      resolve(body.hits.total.value);
    }).catch(function (err) {
      reject(err);
    })
  })
}

async function moviesByDirector(name) {
  return new Promise(async function (resolve, reject) {
    if (name) {
      var options = {
        uri: process.env.ELASTICSEARCH+"/_search",
        method: 'POST',
        json: true,
        body: {
          "_source": ["director", "title", "crew", "year", "mediatype"],
          "query": {
            "match_phrase": {
              "director": name
            }
          }
        }
      };
      rp(options).then(function (body) {
        var finalArray = [];
        body.hits.hits.forEach(function (movie) {
          if ((movie._source) && (movie._source.title)) {
            console.log(movie._source.title)
            finalArray.push(movie);
          }
        })
        resolve(finalArray);
      }).catch(function (err) {
        reject(err);
      })
    } else {
      reject("must supply name for search by director")
    }

  })
};

async function resolveIndexId(id) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: process.env.ELASTICSEARCH+"/_doc/" + id,
      method: 'GET'
    };
    rp(options).then(function (body) {
      resolve(JSON5.parse(body));
    }).catch(function (err) {
      reject(err);
    })
  })
};

async function getDvdMetadata(dvdpath) {
  return new Promise(async function (resolve, reject) {

    var child = spawn('/usr/bin/lsdvd', ['-x', '-Ox', path.join(dvdpath)]);
    var scriptOutput = "";
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', function (data) {
      data = data.toString();
      scriptOutput += data;
    });

    //child.stderr.setEncoding('utf8');
    child.stderr.on('data', function (data) {
      console.log("ERROR: " + data);
    });

    child.on('close', async function (code) {
      var xml = scriptOutput;
      //console.log(xml);
      var parser = new xml2js.Parser({ strict: false, normalizeTags: true });
      parser.parseString(xml, async function (err, result) {
        if ((err) || (!result)) {
          reject(err || "could not read disc");
        } else if (result) {
          if (result.lsdvd) {
            var data = result.lsdvd;
            var longestTrack = data.track.findIndex(x => (x.ix[0] == data.longest_track[0]));
            data.main_title_track = data.track[longestTrack];
            data.track.splice(longestTrack, 1);
            fsUtils.fsize(dvdpath, {
              skipErrors: true
            }, function (err, size) {
              // callback code
              if (err) {
                console.log(err);
                resolve(data);
              } else {
                data.storage_size = size;
                data.storage_size_human = formatBytes(size, 3);
                resolve(data);
              }

            });

          } else {
            reject();
          }
        }
      });
    });
  });
};

async function resetPlaycount(id) {
  return new Promise(async function (resolve, reject) {

    var updateoptions = {
      uri: process.env.ELASTICSEARCH+"/_update/" + id + "?retry_on_conflict=5&refresh=true",
      method: 'POST',
      json: true,
      body: {
        "script": {
          "inline": "ctx._source.playcount = 0; ctx._source.remove(\"lastplayed\")",
          "lang": "painless"
        }
      }
    };

    rp(updateoptions).then(function (body) {
      resolve(body);
    }).catch(function (err) {
      reject(err);
    })
  })
};

async function getResumeState(id) {
  return new Promise(async function (resolve, reject) {

    var options = {
      uri: process.env.ELASTICSEARCH+"/_doc/" + id,
      json: true,
      method: 'GET'
    };

    rp(options).then(function (body) {
      if (body._source.resume) {
        resolve(body._source.resume);
      } else {
        reject()
      }
    }).catch(function (err) {
      reject(err);
    })
  })
};

async function updateResumeInfo(id, resume) {
  return new Promise(async function (resolve, reject) {

    var updateoptions = {
      uri: process.env.ELASTICSEARCH+"/_update/" + id + "?retry_on_conflict=5&refresh=true",
      json: true,
      method: 'POST',
      body: {
        "doc": {
          resume: resume
        }
      }
    };

    rp(updateoptions).then(function (body) {
      resolve(body);
    }).catch(function (err) {
      reject(err);
    })
  })
};

async function incrementPlaycount(title) {
  return new Promise(async function (resolve, reject) {

    var updateoptions = {
      uri: process.env.ELASTICSEARCH+"/_update_by_query",
      method: 'POST',
      json: true,
      body: {
        "script": {
          "inline": "if (!ctx._source.containsKey(\"playcount\")) { ctx._source.playcount = 1; ctx._source.lastplayed = '" + moment().format('x') + "' } else {ctx._source.playcount += 1; ctx._source.lastplayed = '" + moment().format('x') + "'}",
          "lang": "painless"
        },
        "query": {
          "bool": {
            "must": {
              "match_phrase": {
                "title": title
              }
            }
          }
        }
      }
    };

    rp(updateoptions).then(function (body) {
      resolve(body);
    }).catch(function (err) {
      reject(err);
    })
  })
};

async function loan(docid, status, comment) {
  return new Promise(async function (resolve, reject) {
    if (status === true) {
      //item on loan
      var updateoptions = {
        uri: process.env.ELASTICSEARCH+"/_doc/" + docid + "/_update",
        method: 'POST',
        json: true,
        body: {
          "doc": {
            "loan": {
              status: true,
              comment: comment
            }
          }
        }
      };

      rp(updateoptions).then(function (body) {
        resolve(body);
      }).catch(function (err) {
        reject(err);
      })
    } else {
      //item returned
      var updateoptions = {
        uri: process.env.ELASTICSEARCH+"/_doc/" + docid + "/_update",
        method: 'POST',
        json: true,
        body: {
          "script": {
            "inline": "ctx._source.remove(\"loan\")",
            "lang": "painless"
          }
        }
      };

      rp(updateoptions).then(function (body) {
        resolve(body);
      }).catch(function (err) {
        reject(err);
      })

    }


  })
};

async function runAppleScript(osascript, machine) {
  return new Promise(async function (resolve, reject) {

    if (machine.system === 'osx') {
      var cmd = 'ssh -t ' + machine.username + '@' + machine.ip + ' "/usr/bin/osascript "' + osascript;
      var script = exec(cmd);
      script.on('close', function (code) {
        resolve(code);
      })
    } else {
      reject('osascript only possible on osx system');
    };

  });

};

async function damage(docid, status) {
  return new Promise(async function (resolve, reject) {
    var updateoptions = {
      uri: process.env.ELASTICSEARCH+"/_doc/" + docid + "/_update",
      method: 'POST',
      json: true,
      body: {
        "doc": {
          "damaged": status
        }
      }
    };
    rp(updateoptions).then(function (body) {
      resolve(body);
    }).catch(function (err) {
      reject(err);
    })

  })
};


async function linuxVlcCycleSubs(machine) {
  return new Promise(async function (resolve, reject) {

    var child = spawn(path.join(__dirname, 'scripts', 'cyclesubs.sh'), [machine.username, machine.ip, machine.display]);
    child.stdout.on('data', data => {
      console.log(`STDOUT:\n${data}`);
    });

    child.stderr.on('data', data => {
      console.error(`STDERR: ${data}`);
    });

    child.on('exit', function (code) {
      console.log('EXIT CODE: ' + code);
      if (code === 0) {
        resolve(code)
      } else {
        reject(code)
      }
    });

  });
};

async function linuxVlcKeypress(machine, key) {
  return new Promise(async function (resolve, reject) {

    var child = spawn(path.join(__dirname, 'scripts', 'vlckeypress.sh'), [machine.username, machine.ip, machine.display, key]);
    child.stdout.on('data', data => {
      console.log(`STDOUT:\n${data}`);
    });

    child.stderr.on('data', data => {
      console.error(`STDERR: ${data}`);
    });

    child.on('exit', function (code) {
      console.log('EXIT CODE: ' + code);
      if (code === 0) {
        resolve(code)
      } else {
        reject(code)
      }
    });

  });
};

async function linuxVlcSnapshot(machine) {
  return new Promise(async function (resolve, reject) {

    var child = spawn(path.join(__dirname, 'scripts', 'snapshot.sh'), [machine.username, machine.ip, machine.display]);
    child.stdout.on('data', data => {
      console.log(`STDOUT:\n${data}`);
    });

    child.stderr.on('data', data => {
      console.error(`STDERR: ${data}`);
    });

    child.on('exit', function (code) {
      console.log('EXIT CODE: ' + code);
      if (code === 0) {
        resolve(code)
      } else {
        reject(code)
      }
    });

  });
};


async function sshCommand(machine, command) {
  return new Promise(async function (resolve, reject) {

    var child = spawn('ssh', ['-tt', machine.username + '@' + machine.ip, '"' + command + '"']);
    child.stdout.on('data', data => {
      console.log(`STDOUT:\n${data}`);
    });

    child.stderr.on('data', data => {
      console.error(`STDERR: ${data}`);
    });

    child.on('exit', function (code) {
      console.log('EXIT CODE: ' + code);
      if (code === 0) {
        resolve(code)
      } else {
        reject(code)
      }
    });

  });
};

async function revealInFinder(machine, directory) {
  var openCommand;
  var localpath = directory;
  if (machine.system === 'osx') {
    localpath = directory;
    openCommand = 'open';
  } else if (machine.system === 'linux') {
    openCommand = 'DISPLAY=:' + machine.display + ' ' + machine.opencmd;
  };

  wol.wake(machine.hw, function (err, res) {
    if (err) {
      console.log(err);
    } else {
      console.log(res);
      //exec('ssh -t '+machine.username+'@'+machine.ip+' "open '+path.join(localpath)+'"');
      var child = spawn('ssh', ['-tt', machine.username + '@' + machine.ip, openCommand, '"' + localpath + '"']);
      child.stdout.on('data', data => {
        console.log(`stdout:\n${data}`);
      });

      child.stderr.on('data', data => {
        console.error(`stderr: ${data}`);
      });
      child.on('exit', function (code) {
        console.log('Child process exited with exit code ' + code);
        if (machine.system === 'osx') {
          var cmd = 'ssh -t ' + machine.username + '@' + machine.ip + ' "if [ -d \\"' + localpath + '\\" ];then osascript -e \'tell application \\"Finder\\" to activate\';else echo \\"DNE\\";fi;"';
          exec(cmd);
        };
      });
    }
  });
};

async function sendToHandbrake(directory, ip) {

  machine = machines.find(el => el.ip === ip);

  wol.wake(machine.hw, function (err, res) {
    if (err) {
      console.log(err);
    } else {
      console.log(res);

      var localpath = directory;
      // var killhandbrake = exec('ssh -t '+machine.username+'@'+machine.ip+' "killall HandBrake"');
      // killhandbrake.on('close', function(code) {

      // });
      var child = spawn('ssh', ['-tt', machine.username + '@' + machine.ip, 'open -a "HandBrake"  "' + localpath + '"']);
      child.stdout.on('data', data => {
        console.log(`stdout:\n${data}`);
      });

      child.stderr.on('data', data => {
        console.error(`stderr: ${data}`);
      });
      child.on('exit', function (code) {
        console.log('Child process exited with exit code ' + code);
      });

    }

  });

};

async function play(item, machine, id, resume) {

  //defaults
  if (!machine.hw) {
    if (item.mediatype === 'BD') {
      machine = machines.find(el => el.capabilities.includes('BD'));
    } else if (item.mediatype === 'DVD') {
      machine = machines.find(el => el.capabilities.includes('DVD'));
    };
  };
  
  console.log(machine.name, machine.hw);
  var startTime = moment();
  wol.wake(machine.hw, async function (err, res) {
    if (err) {
      console.log(err);
    } else {
      var localpath;
      var vlcbin;
      var display = '';

      if (machine.path) {
	item.path = item.path.replace('/mnt/RAID5',machine.path);
      };

      if (machine.system === 'osx') {
        vlcbin = '/Applications/VLC.app/Contents/MacOS/VLC';
        localpath = item.path;
      } else if (machine.system === 'linux') {
        display = 'DISPLAY=:' + machine.display + ' ';
        vlcbin = '/usr/bin/vlc';
        localpath = item.path;
      };

      if (item.mediatype === 'BD') {
        var cmd = 'ssh -t ' + machine.username + '@' + machine.ip + '  "ps aux | grep -i ' + vlcbin + ' | awk {\'print \\$2\'} | xargs kill -9"';
        console.log(cmd);
        var killvlc = exec(cmd);
        killvlc.stdout.on('data', data => {
          console.log(`stdout:\n${data}`);
        });

        killvlc.stderr.on('data', data => {
          console.error(`stderr: ${data}`);
        });
        killvlc.on('close', function (code) {
          var params = ['-tt', machine.username + '@' + machine.ip, display + vlcbin, '"bluray://' + localpath + '"', '--fullscreen', '--snapshot-path "' + localpath + '"'];
          //console.log("ssh "+params.join(' '));
          var child = spawn('ssh', params);
          child.stdout.on('data', data => {
            console.log(`stdout:\n${data}`);
          });

          child.stderr.on('data', data => {
            console.error(`stderr: ${data}`);
          });
          child.on('exit', function (code) {
            console.log('Child process exited with exit code ' + code);
            var runTime = moment().subtract(startTime).format('x');
            console.log(runTime);
            //600000
            if (runTime > 600000) {
              incrementPlaycount(item.title).then(function (result) {
                console.log("Updated Playcount.")
              }).catch(function (err) {
                console.log("Could not increment playcount.", err)
              });
            };
          });
        });

      } else if (item.mediatype === 'DVD') {
        if (resume) {
          var dvdmetadata = await getDvdMetadata(item.path);
          console.log("Should resume at: " + resume.time + " / " + resume.length + ", title: " + dvdmetadata.longest_track);
        }
        var cmd = 'ssh -t ' + machine.username + '@' + machine.ip + '  "ps aux | grep -i ' + vlcbin + ' | awk {\'print \\$2\'} | xargs kill -9"';
        console.log(cmd);
        var killvlc = exec(cmd);
        killvlc.stdout.on('data', data => {
          console.log(`stdout:\n${data}`);
        });

        killvlc.stderr.on('data', data => {
          console.error(`stderr: ${data}`);
        });
        killvlc.on('close', function (code) {

          var params = ['-tt', machine.username + '@' + machine.ip, display + vlcbin, '"dvdnav://' + localpath + '/VIDEO_TS"', '--fullscreen', '--snapshot-path="' + localpath + '"']
          if (resume) {
            params.push('--start-time=' + resume.time);
            params[3] = '"dvdnav://' + localpath + '/VIDEO_TS#' + dvdmetadata.longest_track + '"';
          }

          const child = spawn('ssh', params);

          function pollVlcStatus() {
            getVlcStatus(machine.ip).then(function (status) {
              if (Number(status.root.time[0]) !== 0) {
                updateResumeInfo(id, { time: status.root.time[0], length: status.root.length[0] }).then(function (result) {
                  //console.log("Updated resume state: "+status.root.time[0]+" / "+status.root.length[0]);
                });
              }
            }).catch(function (error) {
              clearInterval(poller);
            })
          };
          var poller = setInterval(pollVlcStatus, 5000);

          child.stdout.on('data', data => {
            console.log(`stdout:\n${data}`);

          });

          child.stderr.on('data', data => {
            console.error(`stderr: ${data}`);
          });

          child.on('exit', function (code) {
            console.log('Child process exited with exit code ' + code);
            clearInterval(poller);
            var runTime = moment().subtract(startTime).format('x');
            console.log(runTime);
            if (runTime > 600000) {
              incrementPlaycount(item.title).then(function (result) {
                console.log("Updated Playcount.")
              }).catch(function (err) {
                console.log("Could not increment playcount.", err)
              });
            };
          });
        })
      };
    }

  });

};

async function getVlcStatus(ip) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: "http://" + ip + ":8080/requests/status.xml",
      json: false,
      method: 'GET',
      headers: {
        'Authorization': 'Basic OmE='
      }
    };

    rp(options).then(function (body) {
      xml2js.parseString(body, (err, result) => {
        if (err) {
          reject(err);
        }
        resolve(result);
      });
    }).catch(function (err) {
      //console.log(err);
      reject(err);
    })
  });
}

async function getMpaaRatings(title, year, id) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: "https://www.filmratings.com/Filmratings_CARA/WebCaraSearch/Service.asmx?op=GetTitleListStringFullWithPagination",
      json: false,
      method: 'POST',
      body: '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetTitleListStringFullWithPagination xmlns="http://cara.org/"><search><![CDATA[' + title + ']]></search><startRow>1</startRow><endRow>10</endRow></GetTitleListStringFullWithPagination></soap:Body></soap:Envelope>',
      headers: {
        'Content-Type': 'text/xml; charset="UTF-8"',
        'X-Requested-With': 'XMLHttpRequest',
        'SOAPAction': 'http://cara.org/GetTitleListStringFullWithPagination'
      }
    };

    rp(options).then(function (body) {
      xml2js.parseString(body, (err, result) => {
        if (err) {
          throw err;
        }
        var hits = result["soap:Envelope"]["soap:Body"][0].GetTitleListStringFullWithPaginationResponse[0].GetTitleListStringFullWithPaginationResult
        xml2js.parseString(hits, (err, result) => {
          if (err) {
            throw err;
          }
          //console.log(result);
          if (result.SearchResults) {
            if (result.SearchResults.title) {
              result.SearchResults.title.forEach(function (hit) {
                if (hit.year[0] == year) {
                  result.probably = hit;
                  addKeyValueToDoc('mpaa', result.probably, id);
                }
              })
              resolve(result);
            } else {
              reject("no mpaa result");
            }

          }


        });
        resolve(result);

      });
    }).catch(function (err) {
      console.log(err);
      reject(err);
    })
  });
}

async function addKeyValueToDoc(key, value, id) {
  return new Promise(async function (resolve, reject) {
    var updateoptions = {
      uri: process.env.ELASTICSEARCH+"/_update/" + id + "?retry_on_conflict=5&refresh=true",
      json: true,
      method: 'POST',
      body: {
        "doc": {}
      }
    };
    if (value.track) {
      if (value.track.length) {
        value.track.forEach(function (singletrack, index) {
          if (singletrack.df) {
            if (typeof singletrack.df[0] === 'object' && singletrack.df[0] !== null) {
              delete value.track[index].df;
            }
          }
        })
      }
    };
    updateoptions.body.doc[key] = value;
    rp(updateoptions).then(function (body) {
      console.log(body);
      resolve(body);
    }).catch(function (err) {
      console.log(err);
      reject(err);
    })
  })
}

async function getMoreTmdbDetails(id) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: "https://api.themoviedb.org/3/movie/" + id + "?api_key="+process.env.TMDB_APIKEY+"&language=en-US",
      json: true,
      method: 'GET'
    };

    rp(options).then(function (body) {
      resolve(body);
    }).catch(function (error) {
      reject(error);
    })

  });
};


async function getTmdbPersonMovieCredits(id) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: "https://api.themoviedb.org/3/person/" + id + "/movie_credits?api_key="+process.env.TMDB_APIKEY+"&language=en-US",
      json: true,
      method: 'GET'
    };

    rp(options).then(function (body) {
      resolve(body);
    }).catch(function (error) {
      reject(error);
    })

  });
};

async function getTmdbPerson(id) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: "https://api.themoviedb.org/3/person/" + id + "?api_key="+process.env.TMDB_APIKEY+"&language=en-US",
      json: true,
      method: 'GET'
    };

    rp(options).then(function (body) {
      resolve(body);
    }).catch(function (error) {
      reject(error);
    })

  });
};

async function searchTmdbForPerson(name) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: "https://api.themoviedb.org/3/search/person?api_key="+process.env.TMDB_APIKEY+"&language=en-US&query=" + name + "&page=1&include_adult=false",
      json: true,
      method: 'GET'
    };

    rp(options).then(function (body) {
      resolve(body);
    }).catch(function (error) {
      reject(error);
    })

  });
};

async function resolveTmdbDetails(item) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: "https://api.themoviedb.org/3/movie/" + item.id + "/credits?api_key="+process.env.TMDB_APIKEY+"&language=en-US",
      json: true,
      method: 'GET'
    };

    rp(options).then(async function (body) {
      body.director = body.crew[body.crew.findIndex(x => (x.job == 'Director'))] || body.cast[body.cast.findIndex(x => (x.known_for_department == 'Directing'))];
      body.production = await getMoreTmdbDetails(item.id);
      resolve(body);
    }).catch(function (error) {
      reject(error);
    })

  });
};

async function getTmdbMatches(item) {
  return new Promise(async function (resolve, reject) {

    var title = removeSpecials(item.title.replace(/_/g, " "));

    console.log("searching for " + title);

    var options = {
      uri: "https://api.themoviedb.org/3/search/movie?api_key="+process.env.TMDB_APIKEY+"&language=en-US&query=" + title + "&page=1&include_adult=false",
      json: true,
      method: 'GET'
    };
    if (item.year) {
      options.url += ('&year=' + item.year);
    }
    rp(options).then(async function (body) {
      if (body.results.length) {
        var firstTen = body.results.slice(0, 9);
        var done = 0;
        firstTen.forEach(async function (result, index) {
          firstTen[index].details = await resolveTmdbDetails(result);
          done += 1;
          if (done === firstTen.length) {
            finalset = [];
            firstTen.forEach(function (result, index) {
              if ((result.details.director) && (result.release_date)) {
                if (result.release_date.length) {
                  finalset.push(result);
                }
              };
            })
            resolve(finalset);
          }
        })
      } else {
        reject("no results");
      }

    }).catch(function (error) {
      reject(error);
    })

  });
}

async function getBbfcRatings(title, year, id) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: "https://www.bbfc.co.uk/graphql?",
      json: true,
      method: 'POST',
      body: {
        "query": "query Search($url: String!, $searchTerm: String!) { search(url: $url, searchTerm: $searchTerm) { results { classification title type shortFormInsight slug imageUrl sell date dataType _id } }}",
        "variables": {
          "url": "https://www.bbfc.co.uk/",
          "searchTerm": title
        },
        "operationName": "Search"
      }
    };
    console.log("BBFC Request");

    rp(options).then(function (body) {


      if (body.data) {
        var results = {
          raw: body.data.search.results
        };
        if (results.raw.length) {
          results.raw.forEach(function (result) {
            if (((result.title.includes(year)) || (result.title.includes(year - 1)) || (result.title.includes(year + 1))) && (result.type === 'Film')) {
              results.probably = result;
              addKeyValueToDoc('bbfc', results.probably, id);
              if (results.probably.imageUrl) {
                results.probably.imageUrlLarge = results.probably.imageUrl.replace('https://darkroom.bbfc.co.uk/150/', '');
              };
              if (results.probably.shortFormInsight == null) {
                delete results.probably.shortFormInsight;
              };
              if (results.probably.classification == null) {
                delete results.probably.classification;
              };

            }
          });
          console.log("BBFC Response", results);

          resolve(results);
        } else {
          reject("no results");
        };
      } else {
        reject("no results");
      };
    }).catch(function (err) {
      console.log(err);
      reject(err);
    })
  });
}

async function deleteFolderFromIndex(folderpath) {
  return new Promise(async function (resolve, reject) {
    var deleteoptions = {
      uri: process.env.ELASTICSEARCH+"/_delete_by_query?conflicts=proceed&refresh=true",
      json: true,
      method: 'POST',
      body: {
        "query": {
          "bool": {
            "must": {
              "match_phrase": {
                "path": folderpath
              }
            }
          }
        }
      }
    };
    rp(deleteoptions).then(function (body) {
      //console.log(body);
      resolve(body);
    }).catch(function (err) {
      console.log(err);
      reject(err);
    })
  });
};

async function deleteIdFromIndex(metadata) {
  return new Promise(async function (resolve, reject) {
    var deleteoptions = {
      uri: process.env.ELASTICSEARCH+"/_delete_by_query?conflicts=proceed&refresh=true",
      json: true,
      method: 'POST',
      body: {
        "query": {
          "bool": {
            "must": {
              "match_phrase": {
                "path": metadata._source.path
              }
            }
          }
        }
      }
    };
    rp(deleteoptions).then(function (body) {
      //console.log(body);
      resolve(body);
    }).catch(function (err) {
      console.log(err);
      reject(err);
    })
  });
};

async function updateFolderPath(oldpath, newpath) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: process.env.ELASTICSEARCH+"/_search",
      json: true,
      body: {
        "query": {
          "bool": {
            "must": {
              "match_phrase": {
                "path": oldpath
              }
            }
          }
        }
      }
    };
    rp(options).then(async function (body) {
      var updateTarget = body.hits.hits[0];
      if (updateTarget) {
        var newdoc = updateTarget._source;
        newdoc.path = newpath;
        newdoc.title = path.basename(newpath);
        var updateoptions = {
          uri: process.env.ELASTICSEARCH+"/_update/" + body.hits.hits[0]._id + "?retry_on_conflict=5&update=true",
          json: true,
          method: 'POST',
          body: {
            "doc": newdoc
          }
        };

        rp(updateoptions).then(function (body) {
          console.log(body);
          resolve(body);
        }).catch(function (err) {
          console.log(err);
          reject(err);
        })
      } else {
        reject("there is no item with path " + oldpath + " in index")
      }


    }).catch(function (err) {
      console.log(err);
      reject(err);
    })
  });

};

async function addFolderToIndex(folderpath) {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: process.env.ELASTICSEARCH+"/_search",
      json: true,
      method: 'POST',
      body: {
        "_source": ["title", "year", "director", "path", "mediatype"],
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
    rp(options).then(function (body) {
      if (body.hits.total.value === 0) {
        if (folderpath.includes('/Video/BD/')) {
          mediatype = 'BD';
        } else if (folderpath.includes('/Video/DVD/')) {
          mediatype = 'DVD';
        }
        var options = {
          uri: process.env.ELASTICSEARCH+"/_doc",
          json: true,
          method: 'POST',
          body: {
            "title": path.basename(folderpath),
            "path": folderpath,
            "added": moment(),
            "mediatype": mediatype,
            "rating": 0,
            "playcount": 0
          },
        };
        rp(options).then(function (body) {
          console.log(mediatype + " " + path.basename(folderpath) + " added to index.");
          sendToRelay({ channel: 'catalogue', action: 'Added', es: body, data: options.body, timestamp: moment() });
          resolve(body);
        }).catch(function (err) {
          console.log(err);
          reject(err);
        });
      } else {
        console.log("Directory already indexed: " + folderpath + " --> " + body.hits.hits[0]._id)
        resolve();
      }

    }).catch(function (err) {
      console.log("Could not look up path in index.", err);
      reject(err);
    })

  })
};

async function deleteFolderFromIndex(folderpath) {
  return new Promise(async function (resolve, reject) {

    var deleteoptions = {
      uri: process.env.ELASTICSEARCH+"/_delete_by_query?conflicts=proceed&refresh=true",
      json: true,
      method: 'POST',
      body: {
        "query": {
          "bool": {
            "must": {
              "match_phrase": {
                "path.keyword": folderpath
              }
            }
          }
        }
      }
    };
    console.log(deleteoptions.body.query);
    rp(deleteoptions).then(function (body) {
      sendToRelay({ channel: 'catalogue', action: 'Removed', es: body, path: folderpath, timestamp: moment() });
      resolve(body);
    }).catch(function (err) {
      console.log("Error _delete_by_query " + folderpath);
      reject(err);
    })
  });
};

async function getListOfFoldersInVideoPaths() {
  return new Promise(async function (resolve, reject) {
    var todo = videoPaths.length;
    var done = 0;
    var paths = [];
    videoPaths.forEach(function (videoPath) {
      var dirsInDir = fs.readdirSync(videoPath).filter(function (file) {
        return fs.statSync(path.join(videoPath, file)).isDirectory();
      }).filter(item => !(/(^|\/)\.[^\/\.]/g).test(item)).map(dirent => path.join(videoPath, dirent));
      paths = paths.concat(dirsInDir);
      done += 1;
      if (todo === done) {
        resolve(paths);
      };
    });
  });
};

async function getListOfPathsInIndex() {
  return new Promise(async function (resolve, reject) {
    var options = {
      uri: process.env.ELASTICSEARCH+"/_search",
      json: true,
      body: {
        "size": 10000,
        "_source": [
          'path'
        ]
      }
    };

    rp(options).then(function (body) {
      resolve(body.hits.hits);
    }).catch(function (err) {
      reject(err);
    });

  });
};

async function warmUp() {
  return new Promise(async function (resolve, reject) {
    getListOfFoldersInVideoPaths().then(function (folders) {
      var todo = folders.length;
      var done = 0;
      console.log(todo + " folders in video paths...")

      getListOfPathsInIndex().then(function (indexedFolders) {
        folders.forEach(function (folder) {
          var indexInIndex = indexedFolders.findIndex(x => x._source.path === folder);
          if (indexInIndex === -1) {
            addFolderToIndex(folder).then(function (result) {
              done += 1;
              if (todo === done) {
                console.log("Done. All folders in index.");
              };
            }).catch(function (err) {
              console.log(err);
              done += 1;
              if (todo === done) {
                console.log("Done. All folders in index.");
              };
            });
          } else {
            done += 1;
            if (todo === done) {
              console.log("Done. All folders in index.");
            };
          };
        });
      }).catch(function (err) {
        reject(err);
      });

    }).catch(function (err) {
      console.log(err);
    });
  });
};

warmUp();

app.post("/delete",
  async function (req, res) {
    var entry = req.body;
    var deleteoptions = {
      uri: process.env.ELASTICSEARCH+"/_doc/" + req.body._id,
      method: 'DELETE'
    };
    rp(deleteoptions).then(function (body) {
      console.log(req.body._source.title + " deleted from Index");
      res.send(body);
    }).catch(function (err) {
      console.log(err);
      res.send(err);
    })

  });

app.post("/rate",
  async function (req, res) {
    var updateoptions = {
      uri: process.env.ELASTICSEARCH+"/_update/" + req.body.id + "?retry_on_conflict=7",
      method: 'POST',
      json: true,
      body: {
        "script": {
          "inline": "ctx._source.rating = " + req.body.rating + "",
          "lang": "painless"
        }
      }
    };
    rp(updateoptions).then(function (body) {
      res.send(body);
    }).catch(function (err) {
      console.log(err);
      res.send(err);

    })

  });



app.post("/autofill/upsert",
  function (req, res) {
    var tmdbdata = req.body.tmdbdata;
    var currenttitle = req.body.title;

    // replace colon
    tmdbdata.title = tmdbdata.title.replace(/:\s*/g, " – ").replace(/[\(\),.\\?\\!¡]/g, "");;
    var oldPath = req.body.path;
    var newPath = req.body.path.replace(currenttitle, tmdbdata.title);
    var esid = req.body.esid;
    var year = moment(tmdbdata.release_date, 'YYYY-MM-DD').format("YYYY")

    console.log("upsert " + currenttitle)


    processTmdbCastAndCrew(tmdbdata, esid).then(function (response) {
      console.log("processed cast and crew")
      upsertData({ cast: response.cast, crew: response.crew, metadata: tmdbdata }, esid, currenttitle).then(function (result) {
        console.log("data upserted")

        if (currenttitle !== tmdbdata.title) {
          console.log("Renaming " + currenttitle + " to " + tmdbdata.title)
          // temporarily disable watcher
          frontendUpdate = true;
          changeMovieTitle(oldPath, newPath, esid, year).then(function (renameresult) {
            // delete result.cast;
            // delete result.crew;
            result.title = renameresult.title;
            result.path = renameresult.path;
            setTimeout(async function () {
              frontendUpdate = false;
            }, 1000)
            res.send(result);

          })

        } else {
          delete result.cast;
          delete result.crew;
          res.send(result);
        }

      }).catch(function (err) {
        res.send(err)
      })

    }).catch(function (err) {
      console.log(err);
      res.send(err)
    })
  });

app.get("/doc/:docid",
  function (req, res) {
    rp(process.env.ELASTICSEARCH+"/_doc/" + req.params.docid).then(function (response) {
      app.set('json spaces', 2);
      res.send(JSON5.parse(response));
      app.set('json spaces', 0);
    }).catch(function (err) {
      res.send(err);
    })
  });

app.get("/tasks/active",
  async function (req, res) {
    res.send(activeTasks);
  }
);

app.get("/machines",
  function (req, res) {
    var result = JSON.parse(JSON.stringify(machines));

    var clientIp = req.headers['x-forwarded-for'];
    console.log("Machines Endpoint, request from " + clientIp);

    var clientmachine = result.find(el => el.ip === clientIp);
    if (clientmachine) {
      clientmachine.isyou = true;
    };
    res.send(result);
  });

app.get("/dvd/:name/:command",
  function (req, res) {
    var machine = machines.find(el => el.name == req.params.name);
    if (machine.system === 'linux') {
      linuxVlcKeypress(machine, req.params.command).then(function (result) {
        res.send(machine.name + ", " + result + ": OK");
      }).catch(function (err) {
        res.send(machine.name + ", " + err);
      })
    } else {
      res.send("linux only")
    };
  });

app.get("/machine/:name/:command?",
  function (req, res) {
    var machine = machines.find(el => el.name == req.params.name);
    var command = req.params.command;
    if (command === 'snapshot') {
      if (machine.system === 'osx') {
        var osascript = "/Volumes/RAID-8-and-a-half/Software/Scripts/vlcsnapshot.scpt"
        runAppleScript(osascript, machine).then(function (result) {
          res.send({ exit_code: result });
        }).catch(function (err) {
          res.send(err);
        });
      } else if (machine.system === 'linux') {
        linuxVlcSnapshot(machine).then(function (result) {
          res.send({ exit_code: result });
        }).catch(function (err) {
          res.send(err);
        });
      };

    } else if (command === 'cyclesubs') {
      if (machine.system === 'osx') {
        var osascript = "/Volumes/RAID-8-and-a-half/Software/Scripts/cyclesubs.scpt"
        runAppleScript(osascript, machine).then(function (result) {
          res.send({ exit_code: result });
        }).catch(function (err) {
          res.send(err);
        });
      } else if (machine.system === 'linux') {
        linuxVlcCycleSubs(machine).then(function (result) {
          res.send({ exit_code: result });
        }).catch(function (err) {
          res.send(err);
        });
      };
    } else {
      var options = {
        uri: 'http://' + machine.ip + ':8080/requests/status.json',
        json: true,
        timeout: 100,
        method: 'GET',
        headers: {
          'Authorization': 'Basic OmE='
        }
      };
      if (command) {
        options.uri = options.uri + encodeURI('?command=' + command);
        console.log(options.uri);
      }

      rp(options).then(function (body) {
        res.send(body);
      }).catch(function (err) {
        res.send(err);
      })
    }
  });

app.get("/playlist/:name",
  function (req, res) {

    var machine = machines.find(el => el.name == req.params.name);
    var options = {
      uri: 'http://' + machine.ip + ':8080/requests/playlist.json',
      json: true,
      method: 'GET',
      headers: {
        'Authorization': 'Basic OmE='
      }
    };

    rp(options).then(function (body) {
      res.send(body);
    }).catch(function (err) {
      res.send(err);
    })
  });

app.post("/played",
  async function (req, res) {
    incrementPlaycount(req.body._source.title).then(function (response) {
      res.send(response);
    }).catch(function (err) {
      res.status(500).send(err);
    })
  });

app.post("/unplayed",
  async function (req, res) {
    resetPlaycount(req.body._id).then(function (response) {
      res.send(response);
    }).catch(function (err) {
      res.status(500).send(err);
    })
  });

app.post("/loan",
  async function (req, res) {
    loan(req.body.id, req.body.status, req.body.comment).then(function (response) {
      res.send(response);
    }).catch(function (err) {
      res.status(500).send(err);
    })
  });

app.post("/damage",
  async function (req, res) {
    damage(req.body.id, req.body.status).then(function (response) {
      res.send(response);
    }).catch(function (err) {
      res.status(500).send(err);
    })
  });

app.post("/reveal",
  async function (req, res) {
    var folderpath = req.body.path;
    var clientIp = req.headers['x-forwarded-for'];
    var clientmachine = machines.find(el => el.ip == clientIp);
    revealInFinder(clientmachine, folderpath);
    res.status(200).send("ok");
  });

app.post("/rip",
  async function (req, res) {
    var path = req.body.path;
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    sendToHandbrake(path, ip);
    res.status(200).send("ok");
  });

app.post("/play",
  async function (req, res) {
    var entry = req.body.title;
    var machine = req.body.machine;
    var id = req.body.id;
    if (!machine) {
      var clientIp = req.headers['x-forwarded-for'];
      var clientmachine = machines.find(el => el.ip == clientIp);
      play(entry, clientmachine, id, (req.body.resume || false));
    } else {
      play(entry, machine, id, (req.body.resume || false));
    }
    res.status(200).send("ok");
  });

app.get("/resume/:id",
  async function (req, res) {
    getResumeState(req.params.id).then(function (result) {
      res.send(result);
    }).catch(function () {
      res.send("no resume state for " + req.params.id);
    })
  });

app.post("/update",
  async function (req, res) {
    console.log("Update Endpoint");
    var metadata = req.body;
    if (metadata._source.bonus) {
      delete metadata._source.bonus;
    };
    var oldFolderName = path.basename(metadata._source.path);
    var newFolderName = metadata._source.title;
    var oldPath = metadata._source.path;
    var newPath = oldPath.replace(oldFolderName, newFolderName);

    if (oldFolderName !== newFolderName) {
      changeMovieTitle(oldPath, newPath, metadata._id, metadata._source.year).then(function (renameresult) {
        metadata._source.path = renameresult.path;
        metadata._source.title = renameresult.title;
        res.send(metadata)
      }).catch(function (err) {
        res.send(err);
      });
    } else {
      //don't rename folder
      var updateoptions = {
        uri: process.env.ELASTICSEARCH+"/_update/" + metadata._id + "?retry_on_conflict=5&refresh=true",
        json: true,
        method: 'POST',
        body: {
          "doc": metadata._source
        }
      };
      rp(updateoptions).then(function (body) {
        body._source = metadata._source;
        res.send(body);
      }).catch(function (err) {
        console.log(err);
        res.send(err);
      })
    };
  });

async function getShotAslPercentageBuckets(doc) {
  return new Promise(async function (resolve, reject) {
    var buckets = {};
    var result = [];
    var framerate = doc.framerate;
    var shotstodo = doc.shots.length;
    var shotsdone = 0;

    doc.shots.forEach(function (shot) {

      var bucket = parseInt(shot.from_percent);
      if (!buckets[bucket]) {
        buckets[bucket] = [shot];
        shotsdone += 1;
      } else {
        buckets[bucket].push(shot);
        shotsdone += 1;
      }
      if (shotsdone === shotstodo) {
        var bucketstodo = Object.keys(buckets).length;
        var bucketsdone = 0;

        Object.keys(buckets).forEach(function (percentagePointBucket) {
          var percentageBucketSumFrames = 0;
          var percentageBucketAverageShotLength;
          var percentagePointBuckettodo = buckets[percentagePointBucket].length;
          //console.log(percentagePointBucket+"% contains "+buckets[percentagePointBucket].length+" shots")
          var percentagePointBucketdone = 0;

          buckets[percentagePointBucket].forEach(function (shot) {
            percentageBucketSumFrames += shot.duration_frames;
            percentagePointBucketdone += 1;
            if (percentagePointBuckettodo === percentagePointBucketdone) {
              percentageBucketAverageShotLength = (percentageBucketSumFrames / percentagePointBuckettodo) / framerate;
              result.push({ x: percentagePointBucket, y: percentageBucketAverageShotLength, start: new Date(1000 * (buckets[percentagePointBucket][0].from_frame / framerate)).toISOString().substr(11, 8) });

            }
          })
          bucketsdone += 1;
          if (bucketstodo === bucketsdone) {
            var dataset = {
              name: doc.title,
              data: []
            };
            result.forEach(function (percentagePointBucket) {
              dataset.data.push([Number(percentagePointBucket.x), Number(percentagePointBucket.y.toFixed(2)), percentagePointBucket.start]);
            })
            resolve(dataset);
          }
        })
      }
    })
  })
}


app.get("/stats",
  async function (req, res) {
    var unplayed = await getUnplayedCount();
    getStorageStats().then(function (storageStats) {
      storageStats.unplayed = unplayed;
      res.send(storageStats);
    })
  }
)

app.get("/index/:metric?",
  async function (req, res) {
    if (req.params.metric) {
      getIndexStats(req.params.metric).then(function (data) {
        res.send(data);
      })
    } else {
      getIndexStats().then(function (data) {
        res.send(data);
      })
    }
  }
)

app.post("/videocat",
  async function (req, res) {
    console.log("1: Search triggered");
    var sortoptions = req.body.sort;
    var options = {
      uri: process.env.ELASTICSEARCH+"/_search",
      json: true,
      body: {
        "size": 10000,
        "_source": [
          'added',
          'comment',
          'damaged',
          'asl_frames',
          'asl_seconds',
          'bbfc',
          'director',
          'framerate',
          'mediatype',
          'discmetadata',
          'mpaa',
          'number_of_shots',
          'path',
          'playcount',
          'lastplayed',
          'productioncompany',
          'production',
          'rating',
          'title',
          'year',
          'crew',
          'loan'
        ],
        "aggs": {
          "media": {
            "terms": {
              "field": "mediatype.keyword"
            }
          }
        }
      }
    };

    if ((Object.keys(req.body.sort)[0] !== 'writer') && (Object.keys(req.body.sort)[0] !== 'editor')) {
      options.body.sort = req.body.sort;
    };

    if (req.body.searchterm) {
      if (req.body.allfields) {
        options.body.query = {
          "multi_match": {
            "query": req.body.searchterm,
            "type": "phrase_prefix"
          }
        }
      } else {
        options.body.query = {
          "wildcard": {
            "title.keyword": {
              "case_insensitive": true,
              "value": "*" + req.body.searchterm + "*"
            }
          }
        }
      }
    };

    console.log(options.body);

    rp(options)
      .then(function (body) {
        console.log("2: ES Response");
        var numTitles = body.hits.total.value;

        var bonusDiscs = body.hits.hits.filter(function (item) {
          return (item._source.title.split(' ').pop().includes('BONUS'));
        });

        //filter bonus discs
        body.hits.hits = body.hits.hits.filter(function (item) {
          return !(item._source.title.substr(item._source.title.length - 6).includes('BONUS'));
        });

        body.hits.hits.forEach(function (result, index) {

          //commentary
          if (result._source.mediatype === 'DVD') {
            if (result._source.discmetadata) {
              if (result._source.discmetadata.main_title_track.audio) {
                if (result._source.discmetadata.main_title_track.audio.length) {
                  result._source.discmetadata.main_title_track.audio.forEach(function (audioTrack) {
                    if (audioTrack.content[0].toLowerCase().includes('comment')) {
                      result._source.commentary = true;
                    };
                  });
                };
              };
            };
          };
          // if (result._source.discmetadata) {
          //   if ((result._source.mediatype === 'DVD')&&(result._source.discmetadata.main_title_track)) {
          //     if (result._source.discmetadata.main_title_track.audio) {
          //       if (result._source.discmetadata.main_title_track.audio.length) {
          //       result._source.discmetadata.main_title_track.audio.forEach(function(audioTrack){
          //         if (audioTrack.content.includes('comment')) {
          //           result._source.commentary = true;
          //           console.log(result._source.title+" has comments")
          //         };
          //       });
          //     };
          //   };
          //   };
          // };

          //proxies
          var proxyIndex = proxyFiles.findIndex(x => (x.title == result._source.title));
          if (proxyIndex > -1) {
            result._source.proxy = proxyFiles[proxyIndex];
          };

          // bonus discs
          result._source.bonus_discs = bonusDiscs.filter(function (bonusDisc) {
            let titleBits = bonusDisc._source.title.split(' ');
            titleBits.pop()
            return (titleBits.join(' ') === result._source.title);
          });

          // if (result._source.title.substr(result._source.title.length - 6).includes('BONUS')) {
          //   var titleParts = result._source.title.split(' ');
          //   var bonusDiscName = titleParts.pop();
          //   var parentItemIndex = body.hits.hits.findIndex(x=>x._source.title === titleParts.join(' '));
          //   if (parentItemIndex > -1){
          //     console.log(bonusDiscName.toLowerCase()+" -----> "+result._source.path);
          //     body.hits.hits[parentItemIndex]._source[bonusDiscName.toLowerCase()] = result;
          //     body.hits.hits.splice(index, 1);
          //     numTitles-=1;
          //   };
          // };

        });
        body.hits.titles = (numTitles - bonusDiscs.length);
        if (sortoptions['title.keyword']) {
          if (sortoptions['title.keyword'].order === 'asc') {
            body.hits.hits.sort(function (a, b) {
              if (a._source.title.replace('The ', '') > b._source.title.replace('The ', '')) return 1;
              if (a._source.title.replace('The ', '') < b._source.title.replace('The ', '')) return -1;
              return 0;
            });
          } else {
            body.hits.hits.sort(function (a, b) {
              if (b._source.title.replace('The ', '') > a._source.title.replace('The ', '')) return 1;
              if (b._source.title.replace('The ', '') < a._source.title.replace('The ', '')) return -1;
              return 0;
            });
          }
        };
        if ((Object.keys(req.body.sort)[0] !== 'writer') && (Object.keys(req.body.sort)[0] !== 'editor')) {
          console.log("3: Send Response");
          res.send(body);
        } else {
          console.log("3: Sort Response");
          if (Object.keys(req.body.sort)[0] === 'writer') {
            body.hits.hits.sort(function (a, b) {
              var nameA = "";
              var nameB = "";
              filteredCrewA = [];
              filteredCrewB = [];
              if (a._source.crew) {
                filteredCrewA = a._source.crew.filter(crewMember => {
                  return crewMember.roles.includes('Writing');
                });
              };
              if (b._source.crew) {
                filteredCrewB = b._source.crew.filter(crewMember => {
                  return crewMember.roles.includes('Writing');
                });
              };
              if (filteredCrewA.length) {
                nameA = filteredCrewA[0].name;
              };
              if (filteredCrewB.length) {
                nameB = filteredCrewB[0].name;
              }
              if (req.body.sort.writer.order === 'asc') {
                return nameA.localeCompare(nameB);
              } else {
                return nameB.localeCompare(nameA);
              };
            });
            console.log("4: Send Response");
            res.send(body);
          };
          if (Object.keys(req.body.sort)[0] === 'editor') {
            body.hits.hits.sort(function (a, b) {
              var nameA = "";
              var nameB = "";
              filteredCrewA = [];
              filteredCrewB = [];
              if (a._source.crew) {
                filteredCrewA = a._source.crew.filter(crewMember => {
                  return crewMember.roles.includes('Editing');
                });
              };
              if (b._source.crew) {
                filteredCrewB = b._source.crew.filter(crewMember => {
                  return crewMember.roles.includes('Editing');
                });
              };
              if (filteredCrewA.length) {
                nameA = filteredCrewA[0].name;
              };
              if (filteredCrewB.length) {
                nameB = filteredCrewB[0].name;
              }
              if (req.body.sort.editor.order === 'asc') {
                return nameA.localeCompare(nameB);
              } else {
                return nameB.localeCompare(nameA);
              };
            });
            console.log("4: Send Response");
            res.send(body);
          }
        };

      }).catch(function (err) {
        console.log(err);
        res.status(418).send(err);
      });

  });

app.post("/autofill",
  async function (req, res) {
    if (req.body._source.title) {
      getTmdbMatches(req.body._source).then(function (result) {
        res.send(result);
      }).catch(function () {
        res.send("no results");
      });
    } else {
      res.send('no title supplied');
    };
  });


app.get("/details/shots/:esid",
  async function (req, res) {
    rp('http://192.168.1.27:19207/videocat/_doc/' + req.params.esid).then(function (body) {
      var doc = JSON5.parse(body);
      if (doc._source.shots) {
        getShotAslPercentageBuckets(doc._source).then(function (result) {
          res.send(result);
        })
      } else {
        res.send();
      }

      //res.send(body)
    }).catch(function (err) {
      console.log(err);
      res.status(418).send(err);
    });
  });

app.post("/details/bbfc",
  async function (req, res) {
    if ((req.body._source.year) && (req.body._source.title)) {
      getBbfcRatings(req.body._source.title, req.body._source.year, req.body._id).then(function (result) {
        if (result.probably) {
          console.log("Got BBFC Rating");
          res.send(result.probably);
        } else {
          console.log("No good BBFC match");
          res.send("no results");
        }
      }).catch(function (err) {
        console.log(err);
        res.send(err);
      });
    } else {
      res.send('no title or year supplied');
    };
  });

app.post("/details/mpaa",
  async function (req, res) {
    if ((req.body._source.year) && (req.body._source.title)) {
      getMpaaRatings(req.body._source.title, req.body._source.year, req.body._id).then(function (result) {
        console.log("Got MPAA Rating");
        console.log(result.probably);
        res.send(result.probably);
      }).catch(function (err) {
        console.log(err);
        res.send(err);
      });
    } else {
      res.send('no title or year supplied');
    };
  });

app.post("/details/framegrabs",
  async function (req, res) {
    if (req.body._source.path) {
      var pathToScan = req.body._source.path;
      glob(pathToScan + '/*.png', {}, (err, files) => {
        if (files) {
          var urls = [];
          files.forEach(function (screengrabPath) {
            var pathParts = screengrabPath.split('/');
            var filename = path.basename(screengrabPath);
            var mount = pathParts[pathParts.length - 5];
            var media = pathParts[pathParts.length - 3];
            var folder = pathParts[pathParts.length - 2];
            var url = "/api/framegrab/" + encodeURI(mount + "/" + media + "/" + folder + "/" + filename);
            urls.push(url);
          });
          res.send({ urls: urls, tabIndex: 0 });
        } else {
          res.send("no screengrabs found");
        };
      })

    } else {
      res.send("no screengrabs found");
    };
  });

app.post("/details/discmetadata",
  async function (req, res) {
    if (req.body._source.path) {
      if (req.body._source.mediatype === 'DVD') {
        getDvdMetadata(req.body._source.path).then(function (result) {
          addKeyValueToDoc('discmetadata', result, req.body._id);
          res.send(result);
        }).catch(function () {
          res.send("disc metadata could not be read")
        });
      } else {
        getBdMetadata(req.body._source.path).then(function (result) {
          addKeyValueToDoc('discmetadata', result, req.body._id);
          res.send(result);
        }).catch(function () {
          res.send("disc metadata could not be read")
        })
      }
    } else {
      res.send('no path');
    };
  });

app.get("/framegrab/:mount/:media/:name/:file/:size?",
  function (req, res) {
    var mount = req.params.mount;
    var media = req.params.media;
    var name = req.params.name;
    var file = req.params.file;
    var size = req.params.size;
    var pathToSend = path.join('/mnt', mount, 'Video', media, name, file);

    if ((typeof mount !== "undefined") && (typeof media !== "undefined") && (typeof name !== "undefined") && (typeof file !== "undefined")) {
      res.sendFile(pathToSend);
    } else {
      res.status(404).send("File not found.")
    }
  });

async function dedupeNodesAndLinks(data) {
  return new Promise(async function (resolve, reject) {
    var dedupedData = {
      nodes: [],
      links: []
    };
    var todo = (data.nodes.length + data.links.length);
    var done = 0;

    data.links.forEach(function (link) {
      var linkIndex = dedupedData.links.findIndex(x => (((x.source === link.source) && (x.target === link.target)) || ((x.target === link.source) && (x.source === link.target))));
      if (linkIndex === -1) {
        dedupedData.links.push(link);
        done += 1;
        if (todo === done) {
          resolve(dedupedData);
        }
      } else {
        done += 1;
        if (todo === done) {
          resolve(dedupedData);
        }
      }
    })


    data.nodes.forEach(function (node) {
      var nodeIndex = dedupedData.nodes.findIndex(x => (x.id === node.id));
      if (nodeIndex === -1) {
        dedupedData.nodes.push(node);
        done += 1;
        if (todo === done) {
          resolve(dedupedData);
        }
      } else {
        done += 1;
        console.log("Deduped:", node)
        if (todo === done) {
          resolve(dedupedData);
        }
      }
    })
  })
}


async function dedupeNodes(nodes) {
  return new Promise(async function (resolve, reject) {
    var dedupedNodes = [];
    var todo = nodes.length;
    var done = 0;
    nodes.forEach(function (node) {
      var nodeIndex = dedupedNodes.findIndex(x => (x.id === node.id));
      if (nodeIndex === -1) {
        dedupedNodes.push(node);
        done += 1;
        if (todo === done) {
          console.log("Removed " + (todo - dedupedNodes.length) + " duplicate nodes.")
          resolve(dedupedNodes);
        }
      } else {
        done += 1;
        if (todo === done) {
          console.log("Removed " + (todo - dedupedNodes.length) + " duplicate nodes.")
          resolve(dedupedNodes);
        }
      }
    })
  })
}


async function generateNodesForMovie(catalogueItem, type, expansion) {
  return new Promise(async function (resolve, reject) {
    if (catalogueItem._source.cast || catalogueItem._source.crew) {
      if (!expansion) {
        var expansion = 0;
      }
      var movieObject = { id: catalogueItem._source.title, group: catalogueItem._source.mediatype, type: 'movie', year: catalogueItem._source.year, expansion: expansion };
      console.log(movieObject);
      if (!expansion) {
        var expansion = 0;
      }
      var nodeGraphData = {
        movie: catalogueItem,
        nodes: [],
        links: []
      }
      if (type === 'crew') {
        if (catalogueItem._source.crew) {
          var castAndCrewTodo = (Number(catalogueItem._source.crew.length))
          console.log(castAndCrewTodo + " nodes for " + catalogueItem._source.title)
          var castAndCrewDone = 0;
          catalogueItem._source.crew.forEach(function (crewmember) {
            nodeGraphData.nodes.push({ id: crewmember.name, group: crewmember.roles[0], expansion: expansion })
            nodeGraphData.links.push({ source: movieObject.id, target: crewmember.name, expansion: expansion })
            castAndCrewDone += 1;
            if (castAndCrewTodo === castAndCrewDone) {
              //console.log(nodeGraphData)
              resolve(nodeGraphData);
            }
          })
        } else {
          resolve(nodeGraphData);
        }

      } else if (type === 'cast') {
        if (catalogueItem._source.cast) {
          var castAndCrewTodo = (Number(catalogueItem._source.cast.length))
          console.log(castAndCrewTodo + " nodes for " + catalogueItem._source.title)
          var castAndCrewDone = 0;
          catalogueItem._source.cast.forEach(function (castmember) {
            nodeGraphData.nodes.push({ id: castmember.name, group: castmember.roles[0], expansion: expansion })
            nodeGraphData.links.push({ source: movieObject.id, target: castmember.name, value: 0, expansion: expansion })
            castAndCrewDone += 1;
            if (castAndCrewDone === castAndCrewTodo) {
              resolve(nodeGraphData);
            }
          });
        } else {
          resolve(nodeGraphData);
        }

      } else {

        var castAndCrewTodo = (Number(catalogueItem._source.cast.length) + Number(catalogueItem._source.cast.length))
        console.log(castAndCrewTodo + " nodes for " + catalogueItem._source.title)
        var castAndCrewDone = 0;
        catalogueItem._source.cast.forEach(function (castmember) {
          nodeGraphData.nodes.push({ id: castmember.name, group: castmember.roles[0], expansion: expansion })
          nodeGraphData.links.push({ source: movieObject.id, target: castmember.name, expansion: expansion })
          castAndCrewDone += 1;
          if (castAndCrewDone === castAndCrewTodo) {
            resolve(nodeGraphData);
          }
        });
        catalogueItem._source.crew.forEach(function (crewmember) {
          nodeGraphData.nodes.push({ id: crewmember.name, group: crewmember.roles[0], expansion: expansion })
          nodeGraphData.links.push({ source: movieObject.id, target: crewmember.name, expansion: expansion })
          castAndCrewDone += 1;
          if (castAndCrewTodo === castAndCrewDone) {
            //console.log(nodeGraphData)
            resolve(nodeGraphData);
          }
        })
      }

    } else {
      reject("no cast or crew data");
    };
  })
};

app.get("/nodegraph/person/:name/:expansion?",
  function (req, res) {
    var crewmember = req.params.name;
    var expansion;
    if (req.params.expansion) {
      expansion = req.params.expansion;
    } else {
      expansion = 0;
    };

    searchTmdbForPerson(crewmember).then(function (result) {
      if (result.results.length) {
        getTmdbPersonMovieCredits(result.results[0].id).then(function (credits) {
          var finalNodes = {
            nodes: [],
            links: []
          };
          var creditsTodo = credits.crew.length;
          var creditsDone = 0;
          credits.crew.forEach(function (credit) {
            console.log("Checking index for: " + credit.title);
            movieByTitleAndYear(credit.title, moment(credit.release_date, 'YYYY-mm-DD').format('YYYY')).then(function (localMovie) {
              console.log("We have: " + localMovie._source.title + " (" + localMovie._source.year + ")");
              generateNodesForMovie(localMovie, 'crew', expansion).then(function (movieNodes) {
                var movieObject = { id: movieNodes.movie._source.title, group: movieNodes.movie._source.mediatype, type: 'movie', year: movieNodes.movie._source.year, expansion: expansion };
                finalNodes.nodes.push(movieObject);

                finalNodes.nodes = finalNodes.nodes.concat(movieNodes.nodes);
                finalNodes.links = finalNodes.links.concat(movieNodes.links);
                creditsDone += 1;

                if (creditsDone === creditsTodo) {
                  dedupeNodesAndLinks(finalNodes).then(function (result) {
                    res.send(result)
                  })
                }
              }).catch(function (err) {
                creditsDone += 1;

                if (creditsDone === creditsTodo) {
                  dedupeNodesAndLinks(finalNodes).then(function (result) {
                    res.send(result)
                  })
                }
              })
            }).catch(function () {
              console.log("We don't have: " + credit.title + " (" + moment(credit.release_date, 'YYYY-mm-DD').format('YYYY') + ")");

              let movieObj = { id: credit.title, group: 'TMDB', type: 'movie' }

              if (credit.release_date){
                movieObj.year =  moment(credit.release_date, 'YYYY-mm-DD').format('YYYY')
              } else {
                console.log("no year for:",credit)
              };
              finalNodes.nodes.push(movieObj);

              finalNodes.links.push({ source: req.params.name, target: credit.title })

              creditsDone += 1;

              if (creditsDone === creditsTodo) {
                dedupeNodes(finalNodes.nodes).then(function (result) {
                  finalNodes.nodes = result;
                  res.send(finalNodes)
                })
              }
            })

          });


        }).catch(function (err) {
          res.send("API Offline");
        })
      } else {
        res.send(result);
      }
    }).catch(function (err) {
      res.send("API Offline");
    })
  })



app.get("/nodegraph/:id/:type?",
  function (req, res) {

    resolveIndexId(req.params.id).then(function (catalogueItem) {
      moviesByDirector(catalogueItem._source.director).then(function (movies) {
        var moviesTodo = movies.length;
        var moviesDone = 0;
        var movieObject = { id: catalogueItem._source.title, group: catalogueItem._source.mediatype, type: 'movie', year: catalogueItem._source.year };
        var finalNodes = {
          nodes: [],
          links: []
        }
        finalNodes.nodes.push(movieObject);
        movies.forEach(function (movie, index) {
          if (movie._source[req.params.type]) {

            generateNodesForMovie(movie, req.params.type).then(function (movieNodes) {
              console.log(moviesDone + "/" + moviesTodo + ", working on: " + movies[index]._source.title + " (" + movies[index]._source.year + ")");

              var movieObject = { id: movieNodes.movie._source.title, group: movieNodes.movie._source.mediatype, type: 'movie', year: movies[index]._source.year };
              console.log(movieObject);

              finalNodes.nodes.push(movieObject);

              finalNodes.nodes = finalNodes.nodes.concat(movieNodes.nodes);
              finalNodes.links = finalNodes.links.concat(movieNodes.links);
              moviesDone += 1;
              if (moviesDone === moviesTodo) {
                dedupeNodesAndLinks(finalNodes).then(function (result) {
                  res.send(result)
                })
              }
            })

          } else {
            moviesDone += 1;
            if (moviesDone === moviesTodo) {
              dedupeNodesAndLinks(finalNodes).then(function (result) {
                res.send(result)
              })
            }
          }

        })
      }).catch(function (err) {
        res.status(400).send(err)
      })
    })
    // }).catch(function(err){
    //   res.send(err);
    // })
  });

videoPaths.forEach(function (videoPath) {
  var mediatype = path.basename(videoPath);
  //console.log("Starting "+mediatype+" watcher for directory: "+videoPath);
  var watcher = chokidar.watch(videoPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    usePolling: true,
    interval: 250,
    depth: 0
  });
  watcher.on('error', function (error) {
    console.log(`Watcher error: ${error}, ${videoPath}`);
  });
  watcher.on('ready', function () {
    console.log(`Initial ${mediatype} scan complete. ${videoPath} Ready for changes.`);
  });

  var dirRemoved;
  var dirAdded;
  var timer;
  var oldname;

  watcher.on('addDir', async function (newpath) {
    dirAdded = moment();
    var diff = dirAdded - dirRemoved;
    console.log(diff);
    if (diff < 100) {
      clearTimeout(timer);
      console.log(`${mediatype}-WATCHER: Directory ${oldname} has been renamed to ${newpath}, frontendUpdate: ${frontendUpdate}`);
      if (frontendUpdate === false) {
        updateFolderPath(oldname, newpath).then(async function (result) {
          console.log(result);
        }).catch(function (err) {
          console.log("Could not sync folder name to index item:", err)
        });
      };

    } else {
      console.log(`Directory ${newpath} has been added`);
      addFolderToIndex(newpath).then(async function (result) {
        //console.log(result)
      });

    }
  });

  watcher.on('unlinkDir', async function (path) {
    timer = setTimeout(async function () {
      console.log(`Directory ${path} has been removed`);
      deleteFolderFromIndex(path).then(async function (result) {
        console.log(result);
      });
    }, 1000);
    oldname = path;
    dirRemoved = moment();
  });

});

var proxyPath = '/mnt/RAID5/Video/Proxies';
var proxyLogging = false;
const proxywatcher = chokidar.watch(proxyPath, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: false,
  usePolling: true,
  interval: 1000,
  depth: 0
});
// Add event listeners.
proxywatcher
  .on('add', function (watchedpath) {
    var title = path.parse(watchedpath).name;
    var file = path.basename(watchedpath);
    var proxyFilesIndex = proxyFiles.findIndex(x => (x.path === watchedpath));
    if (proxyFilesIndex === -1) {
      proxyFiles.push({ title: title, filename: file, path: watchedpath });
      if (proxyLogging === true) {
        console.log(`File ${watchedpath} has been added`);
      }
    };
  })
  .on('unlink', function (watchedpath) {
    var proxyFilesIndex = proxyFiles.findIndex(x => (x.path === watchedpath));
    if (proxyFilesIndex > -1) {
      console.log(`File ${watchedpath} has been removed`);
      proxyFiles.splice(1, proxyFilesIndex);
    }
  })
  .on('ready', function () {
    var watchedFiles = proxywatcher.getWatched();
    watchedFiles[proxyPath].forEach(function (file) {
      var title = path.parse(file).name;
      proxyFiles.push({ title: title, filename: file, path: path.join(proxyPath, file) })
    });
    //console.log(proxyFiles);
    console.log(`Initial Proxy scan complete. ${proxyPath} Ready for changes.`);
    proxyLogging = true;
  });
