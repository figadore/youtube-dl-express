const yas = require('youtube-audio-server')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const port = 3000

app.use(express.static('static'))

//app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const jsonParser = bodyParser.json()


let queue = []
let successes = []
let failures = []

const jsonErrorHandler = (err, req, res, next) => {
  res.status(500)
  console.error(err.stack)
  res.send({ error: err, stack: err.stack });
  //res.render('error', { error: err })
}

// Routes
app.get('/queue', (req, res) => {
  res.send({
    queue,
  })
})

app.get('/results', (req, res) => {
  res.send({
    queue,
    successes,
    failures,
  })
})

app.post('/queue', jsonParser, (req, res) => {
  console.log("got post request to /queue with body:", req.body);
  const queueItem = {
    urlOrId: req.body.urlOrId,
    author: req.body.author,
    title: req.body.title,
    filename: req.body.filename,
  }
  console.log("adding to queue");
  addToQueue(queueItem)
  res.send({
    success: true,
    item: queueItem
  })
})

app.use(jsonErrorHandler)
// End routes

function addToQueue(queueItem) {
  queue.push(queueItem)
  if (queue.length == 1) {
    console.log("start processing queue");
    processDownloads()
  }
}

function removeFromQueue(queueItem) {
  console.log("Removing the following item from the queue:", queueItem)
  let newQueue = []
  // Not the best way to do this for a couple reasons (effienciency, thraed safety)
  queue.forEach(iterItem => {
    if (queueItem.urlOrId != iterItem.urlOrId || queueItem.author != iterItem.author || queueItem.title != iterItem.title || queueItem.filename != iterItem.filename) {
      newQueue.push(iterItem)
    }
  })
  queue = newQueue
}

function processDownloads() {
  if (queue.length != 0) {
    console.log("starting download, queue length:", queue.length);
    download(queue[0])
  } else {
    console.log("queue empty");
  }
}

function handleError(msg, queueItem) {
  console.error(msg)
  queueItem.error = msg
  // Move queue item to error results
  failures.push(queueItem)
  console.log({ failures })
  removeFromQueue(queueItem)
  processDownloads()
}

async function download(queueItem) {
  if (!queueItem.hasOwnProperty("urlOrId")) {
    console.log("Queue item missing critical property", queueItem)
  }
  const urlOrId = queueItem['urlOrId'].trim()
  const author = queueItem['author'].trim()
  const title = queueItem['title'].trim()
  const inputFilename = queueItem['filename'].trim()
  // Ensure the dir name is valid (a-Z, 0-9, underscores, dashes, periods and spaces
  if (!/^[a-z0-9_ .-]+$/i.test(author)) {
    handleError("Invalid directory name, please use only numbers, letters, underscores, dashes, periods and spaces and try again", queueItem)
  }
  if (!/^[a-z0-9_ .-]+$/i.test(title)) {
    handleError("Invalid directory name, please use only numbers, letters, underscores, dashes, periods and spaces and try again", queueItem)
  }
  // Ensure the file name is valid (a-Z, 0-9, underscores, dashes, periods and spaces
  if (!/^[a-z0-9_ .-]+$/i.test(inputFilename)) {
    handleError("Invalid file name, please use only numbers, letters, underscores, dashes, periods and spaces and try again", queueItem)
  }
  let filename = inputFilename
  // Add mp3 extension if missing
  if (!/.*\.mp3$/.test(inputFilename)) {
    filename = `${inputFilename}.mp3`
  }
  filename = `/youtube-dl/${author}/${title}/${filename}`
  const videoId = getIdFromUrl(urlOrId)
  if (videoId == false) {
    handleError("Regex failed, breaking now", queueItem)
  }
  const useCache = false
  const addMetadata = true
  console.log(`Downloading ${videoId} into ${filename}...`)
  await yas.downloader
    .setFolder(`/youtube-dl/${author}/${title}`) // mkdir if it doesn't exist
    .onSuccess((result) => {
      console.log({ result })
      const videoId = result.id
      const filename = result.file
      console.log(`Yay! Audio (${videoId}) downloaded successfully into "${filename}"!`)
      // Move queue item to success results
      successes.push(queueItem)
      removeFromQueue(queueItem)
      processDownloads()
    })
    .onError(({ id, filename, error }) => {
      handleError(`Sorry, an error ocurred when trying to download ${videoId}: ${error}`, queueItem)
    })
    .download({ id: videoId, file: filename, useCache, addMetadata }, (err, result) => {
      console.log("Download complete. Does this ever happen?")
    })
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Example app listening on port ${port}`)
})

function getIdFromUrl(urlOrId) {
  if (urlOrId.length == 11) {
    console.log(`getIdFromUrl returning ${urlOrId} as is`)
    return urlOrId
  }
  var regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  var match = urlOrId.match(regExp);
  if (match && match[2].length == 11) {
    console.log(`getIdFromUrl returning ${match[2]} as is`)
    return match[2];
  } else {
    console.log(`getIdFromUrl returning false`)
    return false
  }
}

