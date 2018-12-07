const fs = require('fs-extra')
const fetch = require('node-fetch')
const ejs = require('ejs')
const format = require('date-fns/format')
const parse = require('date-fns/parse')

const exportPosts = (posts, rootPath) => {
    if (!rootPath.endsWith('/')) {
        rootPath = rootPath + '/'
    }

    const template = fs.readFileSync('./template.ejs', 'utf8')

    posts.forEach(async post => {
        const date = parse(post.date)

        const Ymd = format(date, 'YYYY-MM-DD')

        const postPath = `${__dirname}/${rootPath}${Ymd}-${post.slug}`
        await fs.ensureDir(postPath)

        post.images.forEach(async image => {
            try {
                const imageResponse = await fetch(image.url)
                const writeStream = fs.createWriteStream(`${postPath}/${image.fileName}`)
                imageResponse.body.pipe(writeStream)
                await streamAsync(writeStream)
            } catch (error) {
                console.error(error)
            }
        })

        post.title = post.title.replace(/"/g, "\\\"") // escape quotes
        const fileContents = ejs.render(template, post)
        await fs.outputFile(`${postPath}/index.md`, fileContents)
    })
}

const streamAsync = (stream) => {
    return new Promise((resolve, reject) => {
        stream.on('end', () => {
            resolve('end');
        })
        stream.on('finish', () => {
            resolve('finish');
        })
        stream.on('error', (error) => {
            reject(error);
        })
    })
}

module.exports = { exportPosts: exportPosts }