const parseString = require('xml2js').parseString;
const TurndownService = require('turndown')
const cheerio = require('cheerio')
const uuid = require('uuid/v4') // v4 generates random UUIDs
const url = require('url')
const path = require('path')

const importPosts = async (xml) => {
    const feed = await parseFeed(xml);

    // Filter for only blog posts
    const items = feed.rss.channel[0].item.filter((item, index) => item['wp:post_type'].includes('post'))
    
    // Map to new object type
    const newItems = items.map(item => {
        if (!item['wp:post_type'].includes('post')) {
            return
        }

        const [tags, categories] = item.category.reduce(([tags, categories], cat) => {
            if (cat['$'].domain === 'post_tag') {
                tags.push(cat._)
            }
            if (cat['$'].domain === 'category') {
                categories.push(cat._)
            }
            
            return [tags, categories];
        }, [[], []]);

        const mappedItem = {
            title: item.title[0],
            date: item.pubDate[0],
            content: item['content:encoded'][0],
            categories: categories,
            slug: item['wp:post_name'][0],
            tags: tags
        }

        // Add passthroughUrl if exists
        const postMeta = item['wp:postmeta']
        if (postMeta) {
            const hasPassthroughUrl = postMeta.find(i => i['wp:meta_key'] === 'passthrough_url')
            if (hasPassthroughUrl) {
                mappedItem.passthroughUrl = hasPassthroughUrl['wp:meta_value']
            }
        }

        // Add images array
        const images = parseImages(mappedItem.content)
        images.forEach(image => {
            mappedItem.content = mappedItem.content.replace(image.url, image.fileName)
        })
        mappedItem.images = images

        // Strip out Squarespace content tags
        mappedItem.content = removeSquarespaceCaptions(mappedItem.content)

        // Add Markdown conversion
        const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        })
        mappedItem.markdownContent = turndownService.turndown(mappedItem.content)

        return mappedItem
    })

    return newItems
}

const parseFeed = xml => new Promise((resolve, reject) => {
    parseString(xml, function (err, result) {
        if(err) reject(err);
        resolve(result);
    });
});

const parseImages = (content) => {
    const postElements = cheerio.load(content)
    const imagesElements = postElements('img')
    const images = imagesElements.map((index, item) => {
        const imageName = uuid()
        const imageUrl = item.attribs['src']
        const imageExtension = path.extname(url.parse(imageUrl).pathname)
        return {
            url: imageUrl,
            fileName: `${imageName}${imageExtension}`
        }
    }).toArray()
    return images
}

const removeSquarespaceCaptions = (post) => {
    // remove the caption crap that gets put in by squarespace
    post = post.replace(/(\[caption.*"])(<.*>)(.*\[\/caption])/g, "$2") 
    return post
}

module.exports = { importPosts: importPosts }