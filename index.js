const {app, BrowserWindow, globalShortcut, Menu} = require('electron')
const path = require('path')

const url = require('url')
const electron = require('electron')

const ipc = electron.ipcMain;

let window = null

const { RoomService } = require('./distjs/RoomService')
const { BookAppointment } = require('./distjs/BookAppointment')
const notifier = require('node-notifier');

global.sharedObj = {
  executing: []
};

const SLEEP_DURATION = 60 * 1000 //10 seconds

function sleepForThrottle(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function BookBot(id, username, password, rooms, datetime, minutes) {
  const roomService = new RoomService(username, password, rooms, datetime, minutes)


  let freeRooms = []
  while (!freeRooms.length) {

    if (! global.sharedObj.executing.includes(id)) {
      // donot do anything
      return {
        freeRooms: freeRooms,
        id: id,
        datetime: datetime,
        minutes: minutes
      }
    }

    console.log('running bot for ' + datetime)
    freeRooms = await roomService.freeRooms().then((freeRooms) => {
      return freeRooms
    })

    if (!freeRooms.length) {
      console.log('no rooms found')
      console.log('sleeping for '+SLEEP_DURATION/1000+' secs before re running bot for ' + datetime)
      await sleepForThrottle(SLEEP_DURATION)
    }
  }

  return {
    freeRooms: freeRooms,
    id: id,
    datetime: datetime,
    minutes: minutes
  }
}


function registerMenu() {
    // Create the Application's main menu
    var template = [{
      label: "Application",
      submenu: [
          { label: "About Application", selector: "orderFrontStandardAboutPanel:" },
          { type: "separator" },
          { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
      ]}, {
      label: "Edit",
      submenu: [
          { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
          { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
          { type: "separator" },
          { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
          { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
          { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
          { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
      ]}
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}


// Wait until the app is ready
app.once('ready', () => {
  if (process.env.NODE_ENV != 'local') {
    globalShortcut.register('CmdOrCtrl+R', () => {});
    registerMenu()
  }
  const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
  // Create a new window
  window = new BrowserWindow({
    // Set the initial width to 800px
    width: width,
    // Set the initial height to 600px
    height: height,
    // Set the default background color of the window to match the CSS
    // background color of the page, this prevents any white flickering
    backgroundColor: "#D6D8DC",
    // Don't show the window until it's ready, this prevents any white flickering
    show: false
  })

  // Load a URL in the window to the local index.html path
  window.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Show window when page is ready
  window.once('ready-to-show', () => {
    window.show()
  })
})

 //Receive and reply to asynchronous message
 ipc.on('asyncSendCancel', (event, args) => {
   var idx = global.sharedObj.executing.indexOf(args.id);
   global.sharedObj.executing.splice(idx, 1);
   console.log(global.sharedObj.executing)
   event.sender.send('asyncSendCancelReply', {id: args.id}); //do nothing
 })

 ipc.on('asyncSend', (event, args) => {

  rooms = args.rooms.split(/\s+/)
  args.rooms = rooms.filter(Boolean)
  args.rooms = args.rooms.slice(0, 100)

  global.sharedObj.executing.push(args.id)

  BookBot(
    args.id,
    args.username,
    args.password,
    args.rooms,
    args.datetime,
    parseInt(args.minutes))
  .then(response => {
    handleResponse(event, response, args)
  }).catch(error => {
    event.sender.send('asyncSendError', {error: error});
  })
 });

 function handleResponse(event, response, args) {
  if (response.freeRooms.length) {
    response.autobook = args.autobook
    event.sender.send('asynReply', response);
    var title = "Room Finder - Found"
    if (args.autobook) {
      title = "Room Finder - Booked"
      bookAppointment(response, args)
    }
    notifier.notify({
      title: title,
      message: response.freeRooms[0]
    });
  }
 }

 function bookAppointment(response, args) {
    BookAppointment(
      args.username,
      args.password,
      args.subject,
      response.freeRooms[0],
      args.datetime,
      parseInt(args.minutes))
    .then( booked => {
      console.log("Room Booked")
    })
 }

app.on('window-all-closed', function () {
  app.quit();
});