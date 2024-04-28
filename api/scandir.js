const spawn = require("child_process").spawn;
const rp = require('request-promise');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const Filehound = require('filehound');


Filehound.create()
  .path('/mnt/RAID-8-and-a-half/Video/BD/')
  .directory()
  .depth(0)
  .find()
  .then((subdirectories) => {
    subdirectories.forEach(function(dvddir){
      console.log(dvddir, path.basename(dvddir));
      var options = {
          uri: "http://10.0.0.27:19207/videocat/_doc",
          json: true,
          method: 'POST',
          body: {
            "title":path.basename(dvddir),
            "path":dvddir,
            "added":moment(),
            "mediatype":'BD'
          },
      };
      rp(options).then(function (body) {
          console.log(body)
      }).catch(function (err) {
          console.log(err)
      });
    });
  });
