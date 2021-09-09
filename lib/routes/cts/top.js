const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://news.cts.com.tw';
    const currentUrl = `${rootUrl}/api/hotnews_realtime_block_jsonp.json`;

    const response = await got({
        method: 'get',
        url: currentUrl,
    });

    const list = JSON.parse(response.data.match(/callback_hotnews_realtime\((\[\{.*\}\])\)/)[1]).map((item) => ({
        title: item.title,
        link: item.newsurl,
        author: item.author,
        pubDate: timezone(parseDate(item.date), +8),
    }));

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const detailResponse = await got({
                    method: 'get',
                    url: item.link,
                });

                const content = cheerio.load(detailResponse.data);

                content('.cts-tbfs').remove();

                item.description = content('.artical-content').html();
                item.category = content('meta[name="section"]').attr('content');
                item.pubDate = parseDate(content('meta[name="pubdate"]').attr('content'));

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '華視新聞網 - Top',
        link: rootUrl,
        item: items,
    };
};
