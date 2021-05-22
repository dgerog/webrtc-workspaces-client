# webRTCWorkspaces

webRTCWorkspaces is a holistic framework (i.e. supports a frontend client lib and a signaling server) that allows the development of a fully functional webRTC app and the option to build on top of the webRTC P2P connection and offer extra functionalities.

Possible uses of the webRTCWorkspace include the Gaming, TeleHealth, TeleEducation, TeleFitness solutions amongst others.

webRTCWorkspaces is build on the rationale to be modular and allow 3rd parties to develop custome themes (regarding the UI/UX) and plugins (regarding the extra funtionalities) hidding all the details regarding the establishment of the P2P connection and the video call.

As it's name implies it is based on the widely used [webRTC](https://webrtc.org/) technology.

## The webRTCWorkspaces Signaling Server

Although webRTC is a P2P connection mechanism is still needs a Signaling Server to allow peers find each other and exchange meta information regarding the P2P connection establishment. webRTC itself does not provide any specs regarding the signaling mechanism.

The webRTCWorkspaces Signaling Server is used to cover that need. For more information please reffer to the related documentation.

> Check the related git repo for the code of the signaling server

## The webRTCWorkspaces Client

The webRTCWorkspaces Client is a pure JS lib used to communicate with the webRTCWorkspaces Signaling Server and in general to offer developers the tools to build their own webRTC app hidding all the details regarding the establishment of the video call. The webRTCWorkspaces Client can be used to load the theme and the various plugin used to buile what we called **a mixed experience video app**.  For more information please reffer to the related documentation.

## jQuery

This folder includes a basic jQuery example of a WebRTCWorkspaces Client built using basic jQuery tools. A simple routing mechanism is also deveolped to support the various app states. `webrtc-workspaces-lib` folder holds all the required code for the client lib. The client is built providing theming options. A default bootstrap theme is added in the `default` folder. You may deploy your own theme. Make sure you keep the name of files `index.js` and `default.css` unchanged.

## Licence

webRTCWorkspaces is an open source project offered via the Apache License. Feel free to use it and build your own amazing app. As atoken of gratitude we are kindly ask to mention the project and help distribute it to other developers.