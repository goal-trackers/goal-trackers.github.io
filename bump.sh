#!/bin/sh
# Pakai: sh bump.sh 1.10.80 1.10.81  — naikkan versi di semua tempat (index, sw, version.json)
sed -i "s/$1/$2/g" index.html sw.js version.json
