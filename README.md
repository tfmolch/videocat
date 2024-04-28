# VideoCat

![videocat](/../main/public/favicon.png?raw=true)

This is a personal media-center project. It is was not designed to be transportable and the code simply grew as I chased the technological object-cause of desire up and down technological alleyways. This project may be interesting for students of Film Studies; Media Studies; Archivists and Film-Fanatics. If you've ever scrolled through a Streaming-Service's catalogue and thought "...but what else do they have by this Director(?)" or "...what else have they got by the screenwriter who did that other thing with these people(?)" – then this project might provide you with some inspiration.

There is an interactive node-graph.


## Screenshots
![Snap1](/../main/screenshots/snap1.png?raw=true)
![Snap2](/../main/screenshots/snap2.png?raw=true)
![Snap3](/../main/screenshots/snap3.png?raw=true)

## State of the Project

There are a lot of moving parts and it's probably a lot of work to get things running. See the requirements. They are probably incomplete. 

You may notice my dreadful habit of throwing all the functionality into a single file. This is because I was a Humanities student and have no formal training as a programmer. Things are better now, but this project was always a weekend sideshow and I just wanted it to work. I wasn't thinking about portability nor had I planned to release the code.

There are internal LAN-URLs and IPs all over the place. There is a list of "playout" Machines right in the main server.js – obviously you have to ditch these and replace them with devices on your LAN.

* all the functionality calling */tasks* API-endpoints relates to other projects which I may commit in future if I can figure out how to clean them up. The catalogue Web-UI will run without registering itself with the */tasks* distribution service. The following functionality will be unavailable:
  * DVD-Ripping
  * OCR Subtitle-Extraction
  * Cut Detection
_________________
##  Beware
There is no security. Only run this on your local LAN.

This is not that *__cool app__ thing* that lets you binge-watch your pirated garbage-pile of torrented rips on a 6" screen. This is asset management software for your physical media. Get Netflix, buy BluRay – don't support piracy.

_________________


## Requirements

###### 1)  *BDMV* and VIDEO_TS structures backed up to folders named after the Film's title.

One movie per folder. ISO images will not work. You must name the folders "BD" and "DVD" as we use the path-segment to identify the mediatype.

###### Example BD:
```bash
/mnt/RAID5 #network accessible storage mount
---------------> /Video/BD #folder containing BluRay backups
---------------> ---------------> /The Third Man/MAKEMKV
```

###### Example DVD:
```bash
/mnt/RAID5 #network accessible storage mount
---------------> /Video/DVD #folder containing BluRay backups
---------------> ---------------> /Home Alone/VIDEO_TS
```

_________________

###### 2) Edit the paths

Find this array in the file __api/server.js__ – you will see my movies are located in these two folders:

```
var videoPaths = [
  '/mnt/RAID5/Video/DVD/',
  '/mnt/RAID5/Video/BD/'
];
```
You can have as many folders named "BD" and "DVD" as you like, mounted wherever you like, but they have to be accessible from your playout device and whatever is running the backend. Every item in the array __videoPaths will be monitored for new additions and scanned on startup.__

> I have dvdbackup and a number of other backup-tools configured to send their output to one of the videoPaths which makes it show up in the Web-UI. Then we can do either manual data-entry or we can use The Movie Database to autofill our index-object.

In the file __api/server.js__ you will also find the array that is used to calculate used/available storage. The entries in here are stat'd at intervals and storage capacity is calculated accordingly. This will usually be the top-level mount-point for every videoPaths-entry (above). It need not contain any video data.

```
var storageMounts = [
  '/mnt/RAID5'
]
```


Change this to suit your needs.
_________________

###### 3) SSH from Server to Playout Device

You need to be able to establish a passwordless SSH session from the device running the backend-API to the __playout__ device as all the remote-controlling is done via _ssh -t_ subprocesses. Key-Auth is not optional.
_________________

###### 4) You must configure at least one Playout Device

* A linux or macos machine with the specs to stream uncompressed BD or DVD data
* Fast network
* Output to TV or Projector
* Your playout device must have VLC installed with the web-interface enabled
* the password for web-access must be set to __"a"__

>you can set a different VLC web-interface password...
You'd need to change all instances of: __'Authorization': 'Basic OmE='__ in server.js

The __machines__ object in the server.js file contains entries like this. I will move this to a configuration file when I have time. For now you have to edit the code.

```js  
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
}
```

| key  | function |
| ------------- | ------------- |
| __name__  |  is what the UI will display |
|__ip__| must be static and is also used to identify the device using the UI|
|__hw__ |is used by [node wol](https://duckduckgo.com/?q=nodejs+wol&ia=web) to wake the device for playback|
|__capabilities__ |can be either/or/both "DVD" and "BD"|
|__username__ |is the user for remote-shelling to the playout-target device. We expect it to have access to the video data and to have a desktop session and privileges to run VLC|
|__system__ |can be "osx" or "linux" and it changes a few things in the *play()* function – eg. on macos we assume VLC is at */Applications/VLC.app...*|
|__opencmd__ |is the command which is executed remotely when you ask the Web-UI to reveal the disc's folder. A file-browser will pop up which contains the video data. For macos this is always "open"; for linux it depends on which file-manager your Desktop Environment is set to use. I've had success with Gnome and KDE using "nautilus" and "kfmclient exec"|
|__display__ |is irrelevant for macos and on linux you have to check what the output of "echo $DISPLAY" is when you have physical access to the machine with an active GUI session. Without this we cannot "reach inside" the active user's active session. VLC may launch and play but remain invisible.|

>__Windows__
>I tried getting Windows to run a VLC instance with remote PowerShell but it seems impossible to launch a GUI App with parameters for the active user (we can't reach inside the active user's desktop session). AFAIK it's by-design. If you know how, please advise.

>__IP-Adress matching__
>if your source-IP (Browser) matches a machine-object, hitting Return/Enter while browsing the catalogue will instantly play the asset on the local/present device.
>The IP-Address matching is also used to auto-select the device in the remote-control panel


_________________

###### 5) You need a TMDB API Key from here: https://developer.themoviedb.org/docs/getting-started

You have to create a .env file in the /api directory and paste it on a new line like so:

 ```
TMDB_APIKEY=XXXXXXX
 ```

_________________


###### 6) You need a Server to run the Backend and Database

* Debian 10,11 or 12
* Node.js v18.15.0 or higher
* An Elasticsearch 7 instance
    * With the mapping from the sample data
    * If you want some data to play with, also the data from the index_backup folder
* NGINX or other reverse proxy (see below)

You have to create an index called videocat

You have to add the elasticsearch endpoint, including the index name to the .env file in the /api folder:
 ```
ELASTICSEARCH=http://192.168.1.27:9200/videocat
 ```

_________________

###### 7) Utilities

* You need to install lsdvd and make it available at __/usr/bin/lsdvd__
*  You need to compile bluray_info and make it available at __/usr/local/bin/bluray_info__

_________________

## Installation
* clone the repo
* run the install from the api directory


 ```bash
cd api
yarn -i
```

* You will need some kind of reverse-proxy to tie up all the bits. Below is my NGINX config. As you can see I'm serving the __/js__ directory as a static alias and directing __/api__ calls to the backend service. URLs are relative but you will need to change all references to abg.thomasfelder.com to a FQDN of your choice.

I do SSL-termination upstream. You can add SSL-certs in the config below.

```
server {
    listen       8083;
    server_name  catalogue.abg.thomasfelder.com;
    access_log   /srv/www/catalogue/access.log;
    error_log   /srv/www/catalogue/error.log;

    location /js  {
      alias    /srv/www/catalogue/api/node_modules;
    }

    root /srv/www/catalogue/public;

    location /api {
        proxy_pass      http://127.0.0.1:3445;
        rewrite /api/(.*) /$1  break;
        proxy_redirect     off;
        proxy_set_header   Host $host;
    }

    # these bits are a fiddly mess and not yet committed...
    #location /tasks {
    #    proxy_pass      http://127.0.0.1:3445;
    #    proxy_redirect     off;
    #    proxy_set_header   Host $host;
    #}

}
```


## Sample Data

* There is sample-data for your Elasticsearch index in the __index_backup__ folder.
* These are backups created with [elasticdump](https://github.com/elasticsearch-dump/elasticsearch-dump). You __must__ import my mapping and you __can__ import my video catalogue data.
* My video library also contains some *cut-detection* data if you're into __cinemetrics__
