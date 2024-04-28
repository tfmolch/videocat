const spawn = require("child_process").spawn;
const rp = require('request-promise');
const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');
const moment = require('moment');
const FileHound = require('filehound');
const xml2js = require('xml2js');

var getMainTitleAudioTracks = function(dvdpath) {

  var child = spawn('/usr/bin/lsdvd',['-x','-Ox',path.join(dvdpath)]);
  var scriptOutput = "";
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', function(data) {
      data=data.toString();
      scriptOutput+=data;
  });

  //child.stderr.setEncoding('utf8');
  child.stderr.on('data', function(data) {
    //console.log("ERROR: "+data);
  });

  child.on('close', function(code) {
    var xml = scriptOutput;
    xml2js.parseString(xml, (err, result) => {
      if(err) {
        //console.log(dvdpath,err);
        return
      } else if (result) {
        if (result.lsdvd) {
          var data = result.lsdvd;
          var longestTrack = data.track.findIndex(x => (x.ix[0] == data.longest_track[0]));
          var audio = data.track[longestTrack].audio;
          var possibles = [];
          audio.forEach(function(track,index){
            if (track.content[0] == 'Comments1'){
              possibles.push(track);
            }
          });
          if (possibles.length){
            console.log(dvdpath)
          }
        }
      }
  });

  });

}

//getMainTitleAudioTracks(currentpath)


const filehound = FileHound.create();
var folders = filehound.paths("/mnt/RAID5/Video/DVD/").depth(0).directory().find();
folders.then(function(paths){
  paths.forEach(function(dvdpath){
    getMainTitleAudioTracks(dvdpath+'/VIDEO_TS');
  })
})
