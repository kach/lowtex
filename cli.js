#!/usr/bin/env node
var l = require("./lowtex.js");
var c = new l();
process.stdin.pipe(c);
c.pipe(process.stdout);
