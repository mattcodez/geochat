#! /bin/bash
java -jar /usr/local/lib/closure-compiler.jar --js clientlibs/main.js clientlibs/util.js clientlibs/geo.js clientlibs/iscroll.js --js_output_file client.min.js
mv client.min.js /var/www/geochat/clientlibs/
cp clientlibs/socket.io.min.js /var/www/geochat/clientlibs/

java -jar /usr/local/lib/yuicompressor.jar --type css -o main-min.css clientlibs/main.css
mv main-min.css /var/www/geochat/clientlibs/main.css

cp index-prod.html /var/www/geochat/index.html
cp server.js ~/geochatrun/ #should probably put this elsewhere
forever stop /home/matt/geochatrun/server.js #until we place in a better spot
forever start ~/geochatrun/server.js -m 100
