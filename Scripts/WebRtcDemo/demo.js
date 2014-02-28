(function () {
    var _myConnection, // My RTCPeerConnection instance
        _myMediaStream; // My MediaStream instance

    // Set up the SignalR connection
    var hub = $.connection.webRtcHub;
    $.connection.hub.url = '/signalr/hubs';
    $.connection.hub.start(function () {
        console.log('connected to signal server.');
        init(); // Start up the app
    });

    // Generates a new connection object and ties up the proper callbacks.
    function _createConnection() {
        console.log('creating RTCPeerConnection...');

        // Create a new PeerConnection
        var connection = new RTCPeerConnection(null); // null = no ICE servers

        // A new ICE candidate was found
        connection.onicecandidate = function (event) {
            if (event.candidate) {
                // Let's send it to our peer via SignalR
                hub.server.send(JSON.stringify({ "candidate": event.candidate }));
            }
        };

        // New remote media stream was added
        connection.onaddstream = function (event) {
            // Create a new HTML5 Video element
            var newVideoElement = document.createElement('video');
            newVideoElement.className = 'video';
            newVideoElement.autoplay = 'autoplay';

            // Attach the stream to the Video element via adapter.js
            attachMediaStream(newVideoElement, event.stream);

            // Add the new Video element to the page
            document.querySelector('body').appendChild(newVideoElement);

            // Turn off the call button, since we should be in a call now
            document.querySelector('#startBtn').setAttribute('disabled', 'disabled');
        };

        return connection;
    }

    // Callback that receives notifications from the SignalR server
    hub.client.newMessage = function (data) {
        var message = JSON.parse(data),
            connection = _myConnection || _createConnection(null);

        // An SDP message contains connection and media information, and is either an 'offer' or an 'answer'
        if (message.sdp) {
            connection.setRemoteDescription(new RTCSessionDescription(message.sdp), function () {
                if (connection.remoteDescription.type == 'offer') {
                    console.log('received offer, sending answer...');

                    // Add our stream to the connection to be shared
                    connection.addStream(_myMediaStream);

                    // Create an SDP response
                    connection.createAnswer(function (desc) {
                        // Which becomes our local session description
                        connection.setLocalDescription(desc, function () {
                            // And send it to the originator, where it will become their RemoteDescription
                            hub.server.send(JSON.stringify({ 'sdp': connection.localDescription }));
                        });
                    }, function (error) { console.log('Error creating session description: ' + error); });
                } else if (connection.remoteDescription.type == 'answer') {
                    console.log('got an answer');
                }
            });
        } else if (message.candidate) {
            console.log('adding ice candidate...');
            connection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }

        _myConnection = connection;
    };

    function init() {
        // Request permissions to the user's hardware
        getUserMedia(
            // Media constraints
            {
                video: true,
                audio: false
            },
            // Success callback
            function (stream) {
                var videoElement = document.querySelector('.video.mine');

                // Store off our stream so we can access it later if needed
                _myMediaStream = stream;

                // Add the stream to our Video element via adapter.js
                attachMediaStream(videoElement, _myMediaStream);

                // Now that we have video, we can make a call
                document.querySelector('#startBtn').removeAttribute('disabled');
            },
            // Error callback
            function (error) {
                // Super nifty error handling
                alert(JSON.stringify(error));
            }
        );

        // Hookup the start button functionality
        document.querySelector('#startBtn').addEventListener('click', function() {
            _myConnection = _myConnection || _createConnection(null);

            // Add our stream to the peer connection
            _myConnection.addStream(_myMediaStream);

            // Create an offer to send our peer
            _myConnection.createOffer(function(desc) {
                // Set the generated SDP to be our local session description
                _myConnection.setLocalDescription(desc, function() {
                    // And send it to our peer, where it will become their RemoteDescription
                    hub.server.send(JSON.stringify({ "sdp": desc }));
                });
            }, function (error) { console.log('Error creating session description: ' + error); });
        });
    }
})();