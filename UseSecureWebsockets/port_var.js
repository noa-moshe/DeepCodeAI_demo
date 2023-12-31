// Commit: https://github.com/portertech/tails/commit/4eeed52eb3201b5e0641b83da76e10385fdfea01#diff-1edaffc2db9e8966da6311b981ed8f61aa7f1c768408a099bd321def09bca8ddL7
// File: https://github.com/portertech/tails/blob/5d101f9cafdae605270900302827e0868d8f026e/public/scripts/websocket.js#L7
// Model: .227

var conn;
var maxNumRows = 200;
var alertsCount = 0;

var connect = function() {
  if (window['WebSocket']) {
    conn = new WebSocket('ws://' + location.hostname + ':8000');
    conn.onopen = function() {
      //alert('Connected to the WebSocket!!'); // Uncomment this if you're in doubt that your browser supports WebSockets
    };
    conn.onmessage = function(evt) {
      data = JSON.parse(evt.data);
      for (var s in streams) {
        if (streams[s].Terms.length > 0) {
          var message = data['message'];
          var pattern = '';
          for (var t in streams[s].Terms) {
            var term = streams[s].Terms[t];
            pattern += '(?=.*' + term + ')';
          }
          pattern += '.*';
          var regex = new RegExp(pattern, 'i');
          if (regex.test(message)) {
            regex = new RegExp('(' + streams[s].Terms.join('|') + ')', 'gi');
            message = message.replace(regex, "<span style=\"background-color: #fd8645;\">$1</span>");
            if (s == 'alerts') {
              $('#alertsnum').html(++alertsCount);
            }
            var num_rows = $('div#logs_container > div#' + s + '_logs > table > tbody:last > tr').size();
            if (num_rows > maxNumRows) {
              $('div#logs_container > div#' + s + '_logs > table > tbody:last > tr:last').remove();
            }
            $('div#logs_container > div#' + s + '_logs > table > tbody:last').prepend('<tr class="row"><td>'+
            data['date'] + '</td><td>'+
            data['host'] + '</td><td>'+
            data['severity'] + '</td><td>'+
            data['facility'] + '</td><td class="message"><div class="hideextra">'+
            message + '</div></td></tr>');
            $('div#logs_container > div#' + s +'_logs > table > tbody:last > tr.row:first').click(function() {
              $(this).toggleClass('message_expanded');
              $(this).children('td.message').children('div').toggleClass('hideextra');
            });
          }
        }
      }
      var num_rows = $('div#logs_container > div#all_logs > table > tbody:last > tr').size();
      if (num_rows > maxNumRows) {
        $('div#logs_container > div#all_logs > table > tbody:last > tr:last').remove();
      }
      $('div#logs_container > div#all_logs > table > tbody:last').prepend('<tr class="row"><td>'+
        data['date'] + '</td><td>'+
        data['host'] + '</td><td>'+
        data['severity'] + '</td><td>'+
        data['facility'] + '</td><td class="message"><div class="hideextra">' + data['message'] + '</div></td></tr>');
      $('div#logs_container > div#all_logs > table > tbody:last > tr.row:first').click(function() {
        $(this).toggleClass('message_expanded');
        $(this).children('td.message').children('div').toggleClass('hideextra');
      });
    }
  }
}

window.onload = connect;
