module.exports = function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy("style");
    eleventyConfig.addPassthroughCopy("shader.js");
    eleventyConfig.addPassthroughCopy("assets");

    eleventyConfig.ignores.add("README.md");

    return {
        dir: {
            input: ".",
            output: "_site",
            includes: "_includes",
            data: "_data",
        },
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk",
    };
};
