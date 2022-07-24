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
  console.log({failures})
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
    filename: req.body.filename,
  }
  console.log("adding to queue");
  addToQueue(queueItem)
  res.send({
    success: true
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
    if (queueItem.urlOrId != iterItem.urlOrId || queueItem.filename != iterItem.filename) {
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

async function download(queueItem) {
  const urlOrId = queueItem['urlOrId']
  const inputFilename = queueItem['filename']
  // Ensure the file name is valid
  if (!/^[a-z0-9_ .-]+$/i.test(inputFilename)) {
    console.error("Invalid file name, please try again")
    failures.push(queueItem)
    console.log({failures})
    removeFromQueue(queueItem)
    processDownloads()
  }
  let filename = inputFilename
  // Add mp3 extension if missing
  if (!/.*\.mp3$/.test(inputFilename)) {
    filename = `${inputFilename}.mp3`
  }
  filename = `/youtube-dl/${filename}`
  const videoId = getIdFromUrl(urlOrId)
  if (videoId == false) {
    console.log("Regex failed, breaking now")
    // Move queue item to error results
    failures.push(queueItem)
    console.log({failures})
    removeFromQueue(queueItem)
    processDownloads()
  }
  const useCache = false
  const addMetadata = true
  console.log(`Downloading ${videoId} into ${filename}...`)
  await yas.downloader
    .onSuccess((result) => {
      console.log({result})
      const videoId = result.id
      const filename = result.file
      console.log(`Yay! Audio (${videoId}) downloaded successfully into "${filename}"!`)
      // Move queue item to success results
      successes.push(queueItem)
      removeFromQueue(queueItem)
      processDownloads()
    })
    .onError(({ id, filename, error }) => {
      console.error(`Sorry, an error ocurred when trying to download ${videoId}`, error)
      // Move queue item to error results
      failures.push(queueItem)
      console.log({failures})
      removeFromQueue(queueItem)
      processDownloads()
    })
    .download({ id: videoId, file: filename, useCache, addMetadata }, (err, result) => {
      console.log("Download complete. Does this ever happen?")
    })
}

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

function getIdFromUrl(urlOrId) {
  if (urlOrId.length == 11) {
    console.log(`getIdFromUrl returning ${urlOrId} as is`)
    return urlOrId
  }
  var regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  var match = url.match(regExp);
  if (match && match[2].length == 11) {
    console.log(`getIdFromUrl returning ${match[2]} as is`)
    return match[2];
  } else {
    console.log(`getIdFromUrl returning false`)
    return false
  }
}

