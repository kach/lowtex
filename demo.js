module.exports = function(converter) {
    converter.commands.banana = function() {
        this.feedLines(["Banana" + this.nspace(this.get("width") - 6)]);
    };
};
