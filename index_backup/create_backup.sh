#! /bin/bash
var=`date +"%FORMAT_STRING"`
now=`date +"%d_%m_%Y"`
echo "Dumping Mapping ${now}..."
elasticdump --input=http://192.168.1.27:9200/videocat --output="/srv/www/catalogue/index_backup/mapping_${now}.json" --type=mapping
echo "Dumping Data ${now}..."
elasticdump --input=http://192.168.1.27:9200/videocat --output="/srv/www/catalogue/index_backup/data_${now}.json" --type=data
