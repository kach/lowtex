/*
    lowtex.js
    ---------
    Pronounced 'loh-tekk'.
    Create fancy .txt files.
    2014 - Hardmath123
*/

var stream = require("stream"),
    util = require("util"),
    chalk = require("chalk");

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
    if (Number(val)) val = Number(val);
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
Converter.prototype.commands.vspace = function(n) {
    if (!n) {n = 1};
    for (var i=0; i<Number(n); i++) {
        this.feedLines([this.nspace(this.get("width"))]);
    }
};
Converter.prototype.commands.plugin = function() {
    // Do not process the plugin if there are no arguments
    if (arguments.length === 0) {
        if (pluginDebug) console.error('Invalid path argument for plugin');
        return;
    }
    // Rather than use function arguments, join all possible arguments with 
    // space in case of file path with spaces
    pluginName = Array.prototype.join.call(arguments, ' ');
    var plugin = null;
    try {
    	plugin = require(pluginName);
    } catch (notFoundOnNodeSearch) {
    	try {
    		// Check if the file is in the working directory
    		plugin = require(path.join(process.cwd(), pluginName));
    	} catch (notFoundLocally) {
    		if (pluginDebug) {
    			console.error('Global Search:\n' + notFoundOnNodeSearch);
    			console.error('Local Search:\n' + notFoundLocally)
    			console.error('Error loading Node module for plugin ' + 
    				pluginName + '! See above for stack trace.');
    			console.error('Ensure the plugin is either in the working ' +
    				'directory, or visible to Node.');
    			return;
    		}
    	}
    }
    if (plugin === null) {
    	if (pluginDebug) console.error('An unknown error occured while ' +
    		'loading plugin with identifier ' + pluginName + '!');
    	return;
    }
    if (plugin.name in this.plugins) {
        if (pluginDebug) console.error('The plugin ' + pluginName + ' or a ' +
        	'plugin with the same name is already loaded!');
        return;
    }
    if ('depends' in plugin) {
        for (var i = 0; i < plugin.depends.length; ++i) {
            if (!plugin.depends[i].name in this.plugins) {
                if (pluginDebug) console.error(plugin.name + ' missing ' +
                	'dependency: ' + plugin.depends[i].name);
                return;
            }
            if ('version' in plugin.depends[i]) {
            	var dependVersion = plugin.depends[i].version.split('.').map(
            		function(n) { return +n; }
            	);
            	var actualVersion = 
            		this.plugins[plugin.depends[i].name].version.split('.')
            		.map(function(n) { return +n; });
            	if (dependVersion > actualVersion ||
            		dependVersion < actualVersion) {
            		if (pluginDebug) {
            			console.error(plugin.name + ' version mismatch for ' +
            				'dependency ' + plugin.depends[i].name);
            			console.error('Expected version ' +
            				this.plugin.depends[i].version +
            				' and found version ' +
            				this.plugins[plugin.depends[i].version]);
            			return;
            		}
            	}
            }
            if (!this.plugins[plugins.depends[i]].enabled) {
            	if (pluginDebug)
            		console.error(plugin.name + ' missing dependency: ' +
            			plugin.depends[i].name +' (dependent plugin was ' +
            			'disabled)'
            		);
            	return;
            }
        }
    } else {
        plugin.depends = [];
    }
    this.plugins[plugin.name] = plugin;
    this.plugins[plugin.name].enabled = false;
    if ('onload' in plugin) {
    	var ready = plugin.onload.apply(this);
    	// !!null returns false, so check for null to avoid disabling plugin 
    	// if no return value for onload is specified
    	if (ready === null) {
    		this.plugins[plugin.name].enabled = true;
    	} else {
    		this.plugins[plugin.name].enabled = !!ready;
    	}
    } else {
    	this.plugins[plugin.name].enabled = true;
    }
    if (!this.plugins[plugin.name].enabled) {
    	if (pluginDebug) {
			console.error('Plugin ' + plugin.name + ' successfully added, ' +
				'but was disabled.');
			console.error('If this was not intentended behavior, check to ' +
				'ensure onload is not defined, returns nothing, or returns ' +
				'a truthy value.');
		}
		// If the plugin was disabled, exit before commands and
		// filters can be added
		return;
	}
    if ('commands' in plugin) {
        for (var commandName in plugin.commands) {
            if (typeof plugin.commands[commandName] !== 'function') {
                if (pluginDebug) console.error('Command ' +
                	commandName + ' was not of type: function');
                return;
            }
            this.commands[commandName] = plugin.commands[commandName];
        }
    } else {
        plugin.commands = {};
    }
    if ('filters' in plugin) {
        for (var filterName in plugin.filters) {
            if (typeof plugin.filters[filterName] !== 'object') {
                if (pluginDebug) console.error('Filter ' + filterName +
                	' was not of type object');
                return;
            }
            if (!'end' in plugin.filters[filterName]) {
                if (pluginDebug) console.error('Filter' + filterName + 
                	' did not specify an "end" function');
                return;
            }
            this.filters[filterName] = {};
            if ('begin' in plugin.filters[filterName]) {
                this.filters[filterName].begin =
                	plugin.filters[filterName].begin;
            }
            this.filters[filterName].end = plugin.filters[filterName].end;
        }
    } else {
        plugin.filters = {};
    }
};

Converter.prototype.plugins = {};

Converter.prototype.nspace = function(n) {
    return new Array(n+1).join(" ");
};

module.exports = Converter;
