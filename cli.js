#!/usr/bin/env node

var opts = require("nomnom")
    .script("lowtex")
    .option('input', {
        position: 0,
        help: 'input file'
    })
    .option('output', {
        abbr: 'o',
        help: 'output file'
    })
    .option('version', {
        abbr: 'v',
        help: 'Print version and exit',
        flag: 'true',
        callback: function() {
            return require("./package.json").version;
        }
    }).parse();

var fs = require("fs");
var l = require("./lowtex.js");
var c = new l();

(opts.input ? fs.createReadStream(opts.input) : process.stdin).pipe(c);
c.pipe(opts.output ? fs.createWriteStream(opts.output) : process.stdout);
