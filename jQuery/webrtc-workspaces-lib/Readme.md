# webRTCWorkspaces

webRTCWorkspaces is JS client library (i.e. running on web browsers) and allows the development of webRTC apps. It handles the communication with the webRTCWorkspaces signaling server and hides the details so as developers focus on the actual development of their mixed experience video app.

## What is a mixed experience video app

A mixed experience video app is a video communication app that offers extra interaction between the participants during the call. The interaction is experienced via adding extra functionallities on top of the sharing video stream. Technically speaking, these functionalities are impelmented as message exchanging between participants and responses upon delivery of these messages.

Each mixed experience video app is percieved as a canvas (or an extra application layer) on top of the video stream via which the app's functionalities are delivered to the end users. The webRTCWorkspaces client library is the frameworks that handles the video communication and gives the developers this canvas and all the required tools to build their app.

## Contents

1. webRTCWorkspaces: The JS lib to interact with the webRTCWorkspaces Signaling Server and deliver the webRTC app.
2. sounds: A folder with the various default sounds for the webRTC app (e.g. ginging, notifications, etc.)

## The webRTCWorkspaces Signaling Server Events

In this section we are going to explain the events that are being watched by the webRTCWorkspaces Client. These events are in response to the Signaling Server events and controll the life circle of a webRTC app.

The events of a webRTCWorkspaces app's circle is as follows:

### Section A: Events related to the webRTC operations

In this section we introduce the various events related to the operations of the webRTC protocol. You may find more information [here](https://webrtc.org/).

- **iceservers** This event is used to communicate the ICE server configuration used to setup a RTCConnection.

- **icecandidate** This event is used to communcate the ICE servers of one peer during the negotiation process.

- **negotiation**  This event is used to emit data (offers/answers) between two peers regarding the webRTC negotiation process.

### Section B: Events related to the webRTCWorkspaces app

In this section we introduce the custom events used in a webRTCWorkspaces app and are related to the life circle of the app. They are mainly used to deliver the required functionality in terms of setting up a workspace or a video call.

- **alert** A general purpose event used to communicate a notification from the Signaling Server to the peer.

- **created** An event sent by the Signaling Server once the workspace is created.

- **destroyed** An event sent by the Signaling Server once the workspace is destroyed (shut down).

- **attendance-granted** An event that informs a peer that accessing a workspace is granted and that the peer is now member of the workspace.

- **re-attendance-granted** Similar to the *attendance-granted* event. Used to restore the session of an already connected peer.

- **attendees** This event is used by the Signaling Server to communicate to a peer all the attendees of a workspace. Maily used in case the local data of the Signa;ing Server are changed.

- **attend** A new attendee has joined the current active workspace. An active workspace is the workspace that the attendee is currently joined.

- **ring** An event used to indicate an incoming call. Used to pass the webRTC meta information (*offer*). Once received the required actions are taken by the client (i.e. play the ringing sound, etc.)

- **answre** An event used to indicate that the incoming call to a peer is accepted.  Used to pass the webRTC meta information (*answer*).

- **busy** An event used to indicate that the incoming call to a peer is rejected.

- **hangup** An event used to indicate that the current on going call is terminated and that the local call resources should be freed.

- **full** An event used to indicate that the workspace the peer tried to join is full and access is not allowed.

As it can be obsrved, these events are mainly bind to the Signaling Server replies and control the behavior of the local webRTC app. Once an event is received, the related regsitered callbacks are also triggered (either custom defined by the developer or the used plugins).

## Security

webRTC by default uses end-to-end encryption of the P2P connection. However, this does not apply for the Signaling Server case. However, we have built the webRTCWorkspaces Signaling Server with the option to activate/deactivate secure data transmission.

## Themes and Plugins

webRTCWorkspaces allows for the developent of custome themes and plugins that control the UI/UX of the the webRTC app (e.g. how a video frame should look like) and the various extra functionalities delivered on top of the video stream (e.g. trigger an event once the call is established). Read the related documentation about how to develop your own theme and plugins and how to use them in your webRTCWorkspaces app.