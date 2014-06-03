/*
    lowtex.js
    ---------
    Pronounced 'loh-tekk'.
    Create fancy .txt files.
*/

var stream = require("stream"),
    util = require("util");

var PARAGRAPH_BREAK = {};

function Converter() {
    stream.Transform.call(this);

    // All the settings
    this.settings = {
        width: ['80'],
        align: ['left'],
        indent: ['off'],
    };

    // Filter stack
    this.stack = [{
        "lines": []
    }];
}
util.inherits(Converter, stream.Transform);



// Utilities for managing the settings stack.
Converter.prototype.set = function(name, value) {
    this.settings[name].push(value);
};
Converter.prototype.unset = function(name) {
    this.settings[name].pop();
};
Converter.prototype.get = function(name) {
    return this.settings[name][this.settings[name].length-1];
};


Converter.prototype.feedWords = function(line, b) {
    var words = line.split(/\s+/);
    var buffer = b;
    var needsSpace = false;
    for (var i=0; i<words.length; i++) {
        if ((buffer + " " + words[i]).length < parseInt(this.get("width"))) {
            buffer += (needsSpace ? " " : "") + words[i];
            needsSpace = true;
        } else {
            this.feedLines([this.align(buffer)]);
            buffer = words[i];
        }
    }
    return buffer;
};

Converter.prototype.align = function(line) {
    var part1 = Math.floor((this.get("width") - line.length + 1)/2);
    var p1 = this.nspace(part1);
    var part2 = (this.get("width") - line.length + 1) - part1;
    var p2 = this.nspace(part2);
    switch(this.get("align")) {
    case "left":
        return line + p1 + p2;
    case "right":
        return p1 + p2 + line;
    case "center":
        return p1 + line + p2;
    }
}

// Feed the top filter more lines.
Converter.prototype.feedLines = function(lines) {
    var l = this.stack[this.stack.length-1];
    Array.prototype.push.apply(l.lines, lines);
};


Converter.prototype.doCommand = function(command) {
    switch (command[0]) {
    case "begin":
        // Enter a new filter
        if (this.filters[command[1]].begin) {
            this.filters[command[1]].begin.apply(this, command.slice(2));
        }
        this.stack.push({
            "filter": this.filters[command[1]],
            "lines": [],
            "args": command.slice(2)
        });
        break;
    case "end":
        // Flush and pop the top filter
        var f = this.stack.pop();
        this.feedLines(f.filter.end.call(this, f.lines, f.args));
        break;


    case "set":
        this.set(command[1], command[2]);
        break;
    case "unset":
        this.unset(command[1]);
        break;

    default:
        this.commands[command[0]].apply(this, command.slice(1));
    }
};

Converter.prototype._transform = function (chunk, encoding, callback) {
    // All lines in the file
    var lines = chunk.toString().split(/\r?\n/);

    // I need to start a new paragraph when needed.
    var newP = false;
    this.buffer = "";

    var endpara = function() {
        if (newP) {
            newP = false;
            this.feedLines([this.align(this.buffer)]);
            this.buffer = "";
        }
    }.bind(this);

    for (var i=0; i<lines.length; i++) {
        var line = lines[i];
        var command = /^\s*@(.*)$/.exec(line);
        if (command) {
            endpara();
            this.doCommand(command[1].toLowerCase().split(/\s+/g));
        } else {
            if (/^\s*$/.test(line)) {
                endpara();
            } else {
                if (newP === false) {
                    this.buffer = this.get("indent") === "on" ? "  " : "";
                }
                newP = true;
                this.buffer = this.feedWords(line, this.buffer);
            }
        }
        // console.log(this.stack);
    }
    callback();
};

Converter.prototype._flush = function() {
    if (this.buffer) this.feedLines([this.align(this.buffer)]);
    this.push(this.stack[0].lines.join("\n") + "\n");
}


Converter.prototype.filters = {};
Converter.prototype.filters.underline = {
    "end": function(lines) {
        var ans = [];
        lines.forEach(function(l) {
            ans.push(l);
            ans.push(l.replace(/[^\s]/gi, "-"));
        });
        return ans;
    }
};

Converter.prototype.commands = {};
Converter.prototype.commands.vspace = function() {
    this.feedLines([this.nspace(parseInt(this.get("width")))]);
};

Converter.prototype.nspace = function(n) {
    return new Array(n+1).join(" ");
};

var c = new Converter();
process.stdin.pipe(c);
c.pipe(process.stdout);
