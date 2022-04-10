const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");
const fetchUrl = require("fetch").fetchUrl;
const Bottleneck = require("bottleneck/es5");
const colors = require("colors");
const settings = JSON.parse(fs.readFileSync("./settings.json"))
const limiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: settings.RateLimit
});

function gethtml(link) {
    return new Promise(resolve => {
        fetchUrl(link, (error, meta, body) => {
            resolve(body.toString())
        });
    })
}

async function GetFilesArray(link) {

    let rawhtml = await gethtml(link);
    if (!rawhtml) console.log("missing html")
    let dom = new JSDOM(rawhtml);

    let doc = dom.window.document;

    let lis = [...doc.getElementsByTagName('li')];

    let files = [];

    lis.forEach(li => {
        let str = li.innerHTML
        str = str.replace(/(<[^>]*>)|\s{2,}/g, "");
        if (str.includes(".zip") && str.startsWith("[")) {
            files.push(str);
        }

    })
    return files;
}


async function Main(apilink) {
    console.log("Thanks to sukebei user rbot2000 for uploading these torrents".green)
    let entries = JSON.parse(await gethtml(apilink))
    if (!entries.success) throw new Error("API call failed, is the API up?".red)
    let filteredEntries = [];
    if (entries.count == 750) console.warn("Warning - exceeded api count, some older links might have been missed".yellow)
    entries.data.forEach((data, index) => {
        if (/Fakku \d+\-\d+/g.test(data.title)) {
            filteredEntries.push(data)
        } else {
            console.log(`removed ${data.title}`)
        }
    })

    let result = ``;

    let lastres;

    let link
    let finishedentries = 0;

    let progressdisplay

    switch(settings.ProgressDisplay.toLowerCase()){
        case "percentage":
            progressdisplay = 0
        break;
        case "exact":
            progressdisplay = 1
        break;
        default:
            console.warn(`${"invalid ProgressDisplay".red}\n${"valid types : \"Percentage\", \"Exact\"".blue}\ndefaulting to Percentage`)
            progressdisplay = 0
    }

    filteredEntries.forEach((entry) => {
        switch (settings.LinkType.toLowerCase()) {
            case "sukebei":
                link = entry.link
                break;
            case "torrent":
                link = entry.torrent
                break;
            case "magnet":
                link = entry.magnet
                break;
            default:
                console.warn(`${"invalid Linktype".red}\n${"valid types : \"Sukebei\", \"Torrent\", \"Magnet\"".blue}\ndefaulting to Sukebei`)
                link = entry.link;
        }
        limiter.schedule(() => GetFilesArray(entry.link))
            .then((Files) => {
                Files.forEach((element) => {
                    result = `${result}\n${element} - ${link}`;
                })
                finishedentries++;
                if(progressdisplay == 0){
                    console.log(((finishedentries/filteredEntries.length)*100).toFixed(2) + "%")
                }else if(progressdisplay == 1){
                    console.log(`${finishedentries} | ${filteredEntries.length}`)
                }
                fs.writeFileSync("./output.txt", result);

                if (result == lastres) console.warn(`${"Nothing was added for entry".yellow} ${entry.link.blue}\n${"perhaps it is missing it's filelist?".yellow}`);
                lastres = result;

                if (finishedentries >= filteredEntries.length) {
                    require('readline')
                        .createInterface(process.stdin, process.stdout)
                        .question(`\n${"Task finished, check output.txt".blue}\n${"Press [Enter] to exit...".blue}`, function () {
                            process.exit();
                        });
                }     
            })
    })

}


Main(settings.APIlink);