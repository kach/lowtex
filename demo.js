/* 
	demo-plugin.js
	----------
	Adds a filter to Lowtex that reverses the character order of words, and a command
	that inserts a horizontal line of variable length.

 	This was intended as an example plugin and as such includes commented examples of
 	things plugins can do that are not necessary to reverse the text.

 	2014 - Sam Lazarus
*/
module.exports = {
	name: 'demo-plugin',
	author: 'Sam Lazarus',
	version: '0.1.1',
//	depends: [ { name: 'some-other-lowtex-plugin', version: '1.0.0' }, { 'name': 'without-version-requirement' } ],
	filters: {
		/*  Can be used in a lowtex file by writing:
			  @begin reverse
			  This text will be reversed
			  @end reverse
			Despite not being shown here, filters can take arguments just like commands!
			Arguments are passed to the "begin" function as the only arguments and to the end function
			after the lines parameter.
		*/
		"reverse": {
/*			"begin": function() {
				// Pre text filter block formatting changes
			},
*/
			"end": function(lines) {
				var ans = [];
				lines.forEach(function(l) {
					words = l.split(' ');
					for  (var i = 0; i < words.length; ++i) {
						words[i] = words[i].split('').reverse().join('');
					}
					ans.push(words.join(' '));
				});
				return ans;
			}
		},
		// Here is a second filter, this time, for underlining things! An alternative to the native underline. (this one underlines internal whitespace too!)
		"underline-all": {
			"end": function(lines, padding) {
				if (!padding) padding = 0;
				padding = +padding;
				var ans = [];
				lines.forEach(function(l) {
					ans.push(l);
					var fullLength = l.replace(/[^\s]/gi, '-');
					var start = fullLength.indexOf('-');
					var end = fullLength.match(/^.*-/)[0].length;
					var innerContent = fullLength.substring(start, end)
					innerContent = innerContent.replace('\t', (new Array(5)).join('-'));
					innerContent = innerContent.replace(/./g, '-');
					var fullContent;
					if (padding > 0) {
						var beginning = fullLength.substring(0, start).replace('\t', '    ');
						var ending = fullLength.substring(end).replace('\t', '    ');
						beginning = beginning.substring(0, beginning.length - padding) + (new Array(padding + 1)).join('-');
						ending = (new Array(padding + 1)).join('-') + ending.substring(padding, ending.length);
						fullContent = beginning + innerContent + ending;
					} else {
						fullContent = fullLength.substring(0, start) + innerContent + fullLength.substring(end);
					}
					ans.push(fullContent)
				});
				return ans;
			}
		}
	},
	commands: {
		/*	Can be used in a Lowtex file by writing:
			  @horizontal-line [n]
			Creates a horizontal line n characters long, if n is not specified,
			defaults to the value of the "width" setting.

			Note how arguments are just accepted as javascript arguments to the function. You can have
			any number of arguments, and your arguments can even be optional as long as you check to see
			if the argument has a normal, or undefined value.
		*/
		"horizontal-line": function(n) {
			if (!n) n = this.get('width');
			n = +n;
			this.feedLines([(new Array(n + 1)).join('-')]);
		}
	},
/*	onload: function() {
		// Do any necessary setup on load. This is a good place to do any necessary modification of settings.
		// if onload returns false or a falsey value (excepting null) the plugin will disable itself.
	}
*/
};