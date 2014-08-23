/*
    lowtex.js
    ---------
    Pronounced 'loh-tekk'.
    Create fancy .txt files.
    2014 - Hardmath123
*/

var stream = require("stream"),
    util = require("util"),
    path = require("path");

var pluginDebug = true;

function Converter() {
    stream.Transform.call(this);

    // All the settings
    this.settings = {
        width: ['80'],
        align: ['left'],
        indent: ['off'],
        pre: ['off'],
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
    var val = this.settings[name][this.settings[name].length-1];
    if (!isNaN(val)) val = Number(val);
    if (val === "on") val = true;
    if (val === "off") val = false;
    return val;
};


Converter.prototype.feedWords = function(line, b) {
    line = line.replace(/\*\*(.*?)\*\*/g, function(a, b) {
        return b.toUpperCase();
    });
    var words = line.split(/\s+/);
    var buffer = b;
    var needsSpace = false;
    for (var i=0; i<words.length; i++) {
        if ((buffer + " " + words[i]).length < this.get("width")) {
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
    var part1 = Math.floor((this.get("width") - line.length)/2);
    var p1 = this.nspace(part1);
    var part2 = (this.get("width") - line.length) - part1;
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
        if (!(command[1] in this.filters)) {
            throw new Error("What's " + command[1] + "?");
            break;
        }
        if (this.filters[command[1]].begin) {
            try {
                this.filters[command[1]].begin.apply(this, command.slice(2));
            } catch (e) {
                if (pluginDebug){
                    console.error(e.stack);
                    console.error('An error occured while running filter ' +
                        '@begin ' + command[1]);
                }
                process.exit(1);
                break;
            }
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
        try {
            this.feedLines(f.filter.end.call(this, f.lines, f.args));
        } catch (e) {
            if (pluginDebug) {
                console.error(e.stack);
                var taggedModifier = command.length > 1 ? ' ' +
                    command[1] : '';
                console.error('An error occured while running filter @end' +
                    + taggedModifier);
            }
            break;
            process.exit(1);
        }
        break;
    case "set":
        this.set(command[1], command[2]);
        break;
    case "unset":
        this.unset(command[1]);
        break;

    default:
        if (!command[0] in this.commands) {
            if (pluginDebug) console.error('Command ' + command[0] + ' was' +
                'undefined');
            process.exit(1);
            break;
        }
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
            if (!/^\s*#/.exec(line)) {
                if (this.get("pre")) {
                    this.feedLines([line]);
                } else {
                    if (/^\s*$/.test(line)) {
                        endpara();
                    } else {
                        if (newP === false) {
                            this.buffer = this.get("indent") ? "   " : "";
                        }
                        newP = true;
                        this.buffer = this.feedWords(line, this.buffer);
                    }
                }
            }
        }
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
Converter.prototype.filters.margin = {
    "begin": function(size) {
        this.set("width", this.get("width") - Number(size));
    },
    "end": function(lines, args) {
        this.unset("width");
        var ans = [];
        var t = this;
        lines.forEach(function(l) {
            ans.push(t.nspace(Number(args[0])) + l);
        });
        return ans;
    }
};
Converter.prototype.filters.twocols = {
    "begin": function() {
        this.set("width", Math.floor(this.get("width")/2 - 1));
    },
    "end": function(lines) {
        this.unset("width");
        var answer = [];
        for (var i=0; i<lines.length/2; i++) {
            answer.push(lines[i]
                + this.nspace(this.get("width") - 2*lines[i].length)
                + (lines[i + Math.floor(lines.length/2) + 1]
                    || this.nspace(lines[i].length)));
        }
        return answer;
    }
}


Converter.prototype.commands = {};

Converter.prototype.commands.require = function(p) {
    require(path.join(process.cwd(), p))(this.filters, this.commands);
}

Converter.prototype.commands.vspace = function(n) {
    if (!n) {n = 1};
    for (var i=0; i<Number(n); i++) {
        this.feedLines([this.nspace(this.get("width"))]);
    }
};

Converter.prototype.nspace = function(n) {
    return new Array(n+1).join(" ");
};

module.exports = Converter;
