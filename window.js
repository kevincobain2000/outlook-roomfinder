try {
  var {preRoomsList} = require('./prerooms')
} catch (e) {
  preRoomsList = {}
}

require('moment/moment')

$(() => {
  const ipc = require('electron').ipcRenderer;
  $('.auto-save').savy('load');

  datetimeIsPastThenSetNow()

  $('#datetime').datetimepicker({
    format:'Y-m-d H:i',
    mask:true,
    minDate:0,
    // minTime:0,
    allowTimes:[
      '09:00','09:30', '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'
    ],
    onChangeDateTime:function(dp,$input) {
      localStorage.setItem("savy-datetime", $input.val());
    }
  });

  $(document).on('click', 'button.room-list-populate', function(e){
    var key = e.target.dataset.key
    var savedRooms = localStorage.getItem('saved-rooms')
    if (savedRooms == null) {
      return null
    }

    var val = JSON.parse(savedRooms)
    roomsList = val[key].join('\n')
    $("#rooms").val(roomsList)
  })

  $(document).on('click', 'button.room-list-delete', function(e){
       swal({
            title: "Are you sure?",
            text: "Please click cancel if unsure",
            type: "warning",
            showCancelButton: true,
            confirmButtonColor: '#DD6B55',
            confirmButtonText: 'Yes, I am sure!',
            cancelButtonText: "No, cancel it!",
            closeOnConfirm: false,
            closeOnCancel: false
         },
         function(isConfirm){
           if (isConfirm){
                var key = e.target.dataset.key
                var savedRooms = localStorage.getItem('saved-rooms')
                if (savedRooms == null) {
                  return null
                }

                var val = JSON.parse(savedRooms)
                delete val[key]
                localStorage.setItem('saved-rooms', JSON.stringify(val))
                populateSavedRooms()
                swal("Deleted!", "List successfully deleted!", "success");
            } else {
                swal("Cancelled", "Your list is safe :)", "error");
            }
         });
  })

  $(document).on('click', 'button.cancel-button', function(e){
    ipc.send('asyncSendCancel', {id: e.target.dataset.id})
  });

  $('#error-username').hide()
  $('#error-password').hide()
  $('#error-subject').hide()
  $('#error-rooms').hide()
  $('#error-datetime').hide()
  $('#error-minutes').hide()

  $('button#submit').click(function(e){
    var params = {
      'id': $.now(),
      'username': $('#username').val(),
      'password': $('#password').val(),
      'autobook': $('#autobook').is(':checked'),
      'subject': $('#subject').val(),
      'rooms': $('#rooms').val(),
      'datetime': $('#datetime').val(),
      'minutes': $('#minutes').val(),
    }

    if (hasInputErrs(params)) {
      ipc.send('asyncSend',params)
      addHistory(params)
      successToast("Item added to the bot")
    } else {
      errorToast("Errors in the input")
    }
  })

  ipc.on('asynReply', (event, args) => {
    updateHistory(args)
    successToast("Empty Rooms found")
   });

   ipc.on('asyncSendError', (event, args) => {
    errorToast("Some error occurred")
    errorToast(args.error.message)
   });

   ipc.on('asyncSendCancelReply', (event, args) => {
    $("#"+args.id).remove()
    updateToast("Item remove from the bot")
   });

   populateSavedRooms()
   promptSaveList()
})

function datetimeIsPastThenSetNow() {
  var now = moment();
  var current = moment($("#datetime").val())
  if ($("#datetime").val() == "") {
    $("#datetime").val(now.format("YYYY-MM-DD HH:mm"))
  }
  if (current.diff(now) < 1) {
    $("#datetime").val(now.format("YYYY-MM-DD HH:mm"))
  }

}
function populateSavedRooms() {
   $("#saved-rooms").empty()
   var savedRooms = localStorage.getItem('saved-rooms')
   if (savedRooms == null || savedRooms == undefined || savedRooms == "{}") {
     savedRooms =JSON.stringify(preRoomsList)
     localStorage.setItem('saved-rooms', savedRooms)
   }

   var savedRooms = JSON.parse(savedRooms)
   for (roomName in savedRooms) {
     var roomsList = savedRooms[roomName]
     buttons = '<button type="button" class="btn btn-sm btn-blue btn-outline mb-1 room-list-populate" data-key="'+roomName+'">'
                + '<i class="fa fa-plus"></i> ' + roomName
              + '</button>'
              + '<button type="button" class="btn btn-sm mb-1 btn-danger room-list-delete" data-key="'+roomName+'">'
              +  '<i class="fa fa-times"></i>'
              +'</button>'
              + '<br>'

     $("#saved-rooms").append(buttons)
   }
}

function promptSaveList() {
  $("#save-rooms-list").click(function(){
    swal({
      title: "Save this list",
      text: "Enter list name, will add current list to your saved rooms list",
      type: "input",
      showCancelButton: true,
      closeOnConfirm: false,
      inputPlaceholder: "List name"
    }, function (inputValue) {
      if (inputValue === false) return false;
      if (inputValue === "") {
        swal.showInputError("You need to write something!");
        return false
      }
      saveList(function(ret) {

        var savedRooms = localStorage.getItem('saved-rooms')
        var val = {}
        if (savedRooms != null) {
          val = JSON.parse(savedRooms)
        }

        val[inputValue] = $('#rooms').val().split(/\s+/)
        localStorage.setItem('saved-rooms', JSON.stringify(val))

        swal("Saved!", "List is saved - " + inputValue, "success");
        populateSavedRooms()
      })

    });
  })
}
function populateSavedList(cb) {
  return cb(true)
}
function saveList(cb) {
  return cb(true)
}

function hasInputErrs(params) {
  $('#error-username').hide()
  $('#error-password').hide()
  $('#error-subject').hide()
  $('#error-rooms').hide()
  $('#error-datetime').hide()
  $('#error-minutes').hide()

  var has_err = false
  if (!params.username) {
    has_err = $('#error-username').show()
  }
  if (!params.password) {
    has_err = $('#error-password').show()
  }
  if (!params.subject) {
    has_err = $('#error-subject').show()
  }

  if (!params.rooms || params.rooms.split(/\s+/).length > 100) {
    has_err = $('#error-rooms').show()
  }
  if (!params.datetime || moment(params.datetime).isBefore()) {
    has_err = $('#error-datetime').show()
  }
  if (!params.minutes) {
    has_err = $('#error-minutes').show()
  }
  return has_err == false
}

function successToast(msg) {
  $.toast({
    heading: 'Success',
    position: 'bottom-center',
    text: msg,
    showHideTransition: 'slide',
    icon: 'success',
    loader: false,
  })
}
function updateToast(msg) {
  $.toast({
    heading: 'Info',
    position: 'bottom-center',
    text: msg,
    icon: 'info',
    loader: false,
    showHideTransition: 'slide',
    loaderBg: '#9EC600'
  })
}

function errorToast(msg) {
  $.toast({
    heading: 'Error',
    position: 'bottom-center',
    text: msg,
    icon: 'error',
    loader: false,
    showHideTransition: 'slide',
    loaderBg: '#9EC600'
  })
}

function updateHistory(args) {
  $("#status-" + args.id).html('<span class="badge badge-pill badge-success mb-2">Completed</span>')
  $("#status-" + args.id).append("<br>")
  $("#cancel-button-" + args.id).remove()

  var msg = ''
  if (args.autobook) {
    msg += '<b>☆☆☆BOOKING DETAILS☆☆</b> - <small>Check your outlook calendar</small><br>'
  } else {
    msg += '<b>■List of Rooms</b> -<small>Nothing Auto Booked</small><br>'
  }

  if (args.autobook) {
    msg += '<div class="alert alert-success monospace">'+
        'Room: <strong>' + args.freeRooms[0] +' </strong><br>Datetime: <b>' + args.datetime + '</b><br>Duration: <b>' + args.minutes + ' mins</b>'+
      '</div>'
  }

  msg += '<small>These rooms are available too for your query</small><br>'+
  '<div class="alert alert-info list-scroll monospace no-wrap">'+
      args.freeRooms.join("<br>") +
    '</div>'
  $("#status-" + args.id).append(msg)
}
function addHistory(params) {
    var html = '<div class="card mb-2" id="'+params.id+'">'+
      '<div class="card-body">'+
          '<dl>'+
            '<dt>Bot ID: '+params.id+'<time class="timeago text-thin text-small pull-right" datetime="'+new Date()+'">'+moment().format("YYYY-MM-DD HH:mm")+'</time><span class="text-thin pull-right text-small">Started &nbsp;</span></dt>'+
            '<dd id="status-'+params.id+'" class="status-box border">'+
              '<span class="badge badge-pill badge-primary mr-2">Running</span>'+
               '<small class="text-muted">Will keep on running until it finds a room</small>'+
              '</dd>'+
            '<dt>Subject</dt>'+
            '<dd><i>'+params.subject+'</i></dd>'+
            '<dt>DATETIME</dt>'+
            '<dd class="monospace">'+params.datetime+'</dd>'+
            '<dt>Duration</dt>'+
            '<dd class="monospace">'+params.minutes+' minutes</dd>'+
            '<dt>Autobook</dt>'+
            '<dd class="monospace">'+params.autobook+'</dd>'+
            '<dt>Search Rooms</dt>'+
            '<dd>'+
              '<div class="alert alert-light border list-scroll monospace no-wrap">'+
                params.rooms.split(/\s+/).join("<br>") +
              '</div>'+
            '</dd>'+
          '</dl>'+
          '<button type="button" class="btn btn-sm btn-danger btn-block mt-2 cancel-button" id="cancel-button-'+params.id+'" data-id="'+params.id+'"><i class="fa fa-times"></i> Cancel</button>'+
      '</div>'+
    '</div>'
    $("#history").prepend(html)
}