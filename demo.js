module.exports = function(filters, commands) {
    commands.banana = function() {
        this.feedLines(["Banana" + this.nspace(this.get("width") - 6)]);
    };
};
