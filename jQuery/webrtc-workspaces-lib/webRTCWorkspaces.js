"use strict";

const MIN_HANGUP_TIMEOUT = 10000;
const DEFAULT_HANGUP_TIMEOUT = 45000;

class webRTCWorkspaces {
    constructor(options) {
        //
        // check for dependencies
        //
        // sockets.io(sockets)
        if (typeof io !== "function")
            throw "Required lib is missing (socket.io). Please include in index.html file.";
        // localstorage (in case the storage option is activated)
        if (options.doStorage && typeof window.localStorage !== "object")
            throw "localStorage is not supported.";

        //set debug mode
        this.debug = options.debug ?  true : false;

        //
        // INITIALIZE OBJECT
        //
         
        //configurable parameters(user allowed to edit)
        this.iceServers = null; //set to null to indicate NO initialization
        //default wait 30 seconds to reply ~ VALUES LESS THAN 10sec ARE IGNORED
        this.awaitRingingBeforeHangUp = options.awaitRingingBeforeHangUp && options.awaitRingingBeforeHangUp>=MIN_HANGUP_TIMEOUT ? options.awaitRingingBeforeHangUp : DEFAULT_HANGUP_TIMEOUT;

        //set the storage state - by default NO storage is activated [GDPR]
        this.doStorage = options.doStorage ? true : false;
        if (!this.doStorage)
            window.localStorage.clear(); //NO local storage => clear any old data

        //internal parameters
        this._resetObject(true);
        
        //open connection to Signaling Server - Start listening
        this._startPingingWorkspace(options);
        this.attendees = {};
        if (this.workspace) {
            //if workspace is initialized, then ask for attendees
            this.socket.emit(
                "attendees", {
                    workspace: {
                        id: this.workspace.id
                    },
                    attendee: {
                        id: this.attendee.id,
                    },
                    accessToken: this.accessToken,
                }
            );
        }
            

        //just after establishing connection -> ask a list of ice servers => emit event
        this.socket.emit("iceservers",{});

        //once page loaded check if there is an active workspace - IF YES JOIN INSTANTLY
        const currentOnLoadFunc = window.onload;
        window.onload = () => {
            //make sure to execute any current onload function
            currentOnLoadFunc && currentOnLoadFunc();
            if (this.workspace && this.attendee) {
                this._restoreSession(); //restore joined workspace session
            }
            if (this.debug) {
                console.log(
                    (this.workspace && this.attendee)
                    ?
                    "An existing session detected - Restoring..."
                    :
                    "No existig session. Start fresh..."
                );
            }
        };

        //in case of page refresh emit "leave" message
        window.onunload =() => {
            if (this.workspace && this.attendee) {
                this.socket.emit(
                    "leave",
                    {
                        workspace: {
                            id: this.workspace.id
                        },
                        attendee: this.attendee,
                        accessToken: this.accessToken,
                    }
                );
            }
        };
    };

    //
    // PUBLIC METHODS
    //

    //
    // VARIOUS UTILS
    //
    registerPlugin(plugin) {
        if (typeof plugin.name === "undefined") {
            throw "Invalid plugin name.";
        }
        
        //append plugin name in list
        this.plugins.push(plugin.name);

        //register view callbacks
        if (typeof plugin.views !== "undefined")
            Object.keys(plugin.views).forEach(evt => this.registerCallback(`${plugin.name}::${evt}`, plugin.views[evt]));

        //register event
        if (typeof plugin.events !== "undefined")
            Object.keys(plugin.events).forEach(evt => this.registerCallback(`${plugin.name}::${evt}`, plugin.events[evt]));
    };
    registerCallback(events, fn) {
        //success
        if (typeof events === "string") {
            events = [events]; //single event(i.e. string argument) -> convert to array and proceed
        }
        events.forEach((evt) => {
            if (this.registeredCallbacks[evt])
                delete this.registeredCallbacks[evt]; //delete any previous registration
            if (typeof fn === "function")
                this.registeredCallbacks[evt] = fn; //singlefunction argument ~ infere only success case
            else
                throw "Invalid callback argument.";
        });
    };
    unRegisterCallback(events) {
        if (typeof events === "string") {
            events = [events]; //single event(i.e. string argument) -> convert to array and proceed
        } 
        events.forEach((evt) => {
            if (this.registeredCallbacks[evt]) {
                delete this.registeredCallbacks[evt]; //delete any previous registration
            }
        });
    };
    getLocal() {
        //return the instance of the local user
        return(this.attendee);
    };
    getAttendee(attendeeID) {
        //return the instance of the attendee by ID
        return(this.attendees[attendeeID]);
    };
    getHost() {
        //return the instance of the workspace host
        return(this.attendees[this.workspace.owner] || this.attendee);
    };
    getWorkspace() {
        //return the instance of the current workspace
        return(this.workspace);
    };
    isLocal(attendeeID) {
        return(this.attendee && this.attendee.id == attendeeID);
    };
    isOwner() {
        return(this.workspace && this.attendee && this.attendee.id == this.workspace.owner);
    };
    isOnCall(callID = null) {
        //is localhost on call?
        return(callID ? (this.call !== "undefined" && this.call.id == callID) : (typeof this.call !== "undefined"));
    };
    hasJoined() {
        //has the user joined/created a workspace
        return(this.workspace !== null);
    };
    numberOfParticipants() {
        return(this.attendees ? Object.keys(this.attendees).length + 1 : 1);
    };
    getAttendees() {
        return(this.attendees);
    }



    //
    // APP STATE (per attendee)
    //
    setState(attendeeID, state) {
        if (typeof state !== "object") {
            throw "Invalid state object.";
        }
        if (attendeeID == this.attendee.id) {
            //local state
            this.attendee.state = this.attendee.state || {};
            Object.keys(state).forEach(key => this.attendee.state[key] = state[key]);
        }
        else {
            //remote state
            if (this.attendees[attendeeID]) {
                this.attendees[attendeeID].state = this.attendees[attendeeID].state || {}; //init
                Object.keys(state).forEach(key => this.attendees[attendeeID].state[key] = state[key]);
            }
        }
    };
    getState(attendeeID = null) {
        if (!attendeeID || attendeeID == this.attendee.id) {
            //local state
            return(this.attendee.state || null);
        }
        else {
            //remote state
            if (this.attendees[attendeeID]) {
                return(this.attendees[attendeeID].state || null);
            }
        }
        return(null);
    };
    clearState(attendeeID, state) {
        if (typeof state === "string")
            state = [state]; //in case of a single string argument, convert to array
        if (typeof state !== "array") {
            throw "Invalid state keys.";
        }
        if (attendeeID == this.attendee.id) {
            //local state
            this.attendee.state = this.attendee.state || {};
            state.forEach(key => delete this.attendee.state[key]);
        }
        else {
            //remote state
            if (this.attendees[attendeeID]) {
                this.attendees[attendeeID].state = this.attendees[attendeeID].state || {}; //init
                state.forEach(key => delete this.attendees[attendeeID].state[key]);
            }
        }
    };
    clearAllStates(state) {
        if (typeof state === "string")
            state = [state]; //in case of a single string argument, convert to array
        if (typeof state !== "object") {
            throw "Invalid state keys.";
        }

        //local state
        this.attendee.state = this.attendee.state || {};
        state.forEach(key => delete this.attendee.state[key]);
        
        //remote state
        for(let attnd in this.attendees) {
            this.attendees[attnd].state = this.attendees[attnd].state || {}; //init
            state.forEach(key => delete this.attendees[attnd].state[key]);
        }
    };
    filterState(fn) {
        if (typeof fn !== "function") {
            throw "Invalid callback filter.";
        }

        const items = [];
        if (fn(this.attendee.state)) {
            items.push(this.attendee.id);
        }
        for(let attnd in this.attendees) {
            if (this.attendees[attnd].state && fn(this.attendees[attnd].state)) {
                items.push(attnd);
            }
        }

        return(items);
    };



    //
    // STORAGE HANDLING
    //
    setStorageState(state) {
        if (state) {
            //if instructed to use local storage -> initialize with current state
            this._storeData("attendee", this.attendee);
            this._storeData("workspace", this.workspace);
            this._storeData("accessToken", this.accessToken);
        }
        this.doStorage = state;
    };



    //
    // WORSPACES
    //
    createWorkspace(workspaceName, workspacePin, attendeeName) {
        this._consumeCallback("loading");

        this.socket.emit(
            "create",
            {
                workspace: {
                    name: workspaceName,
                    pin: workspacePin,
                    avatar: "",
                },
                attendee: {
                    name: attendeeName,
                    avatar: "",
                },
                nonce: this._getNonce("create-workspace"),
            }
        );
    };
    destroyWorkspace() {
        if (this.debug) {
            console.log("Terminating the workspace...");
        }

        this._hangUp(); //end any call before terminating the workspace
        this.socket.emit(
            "destroy",
            {
                workspace: {
                    id: this.workspace.id
                },
                attendee: {
                    id: this.attendee.id
                },
                accessToken: this.accessToken,
            }
        );
    };
    joinWorkspace(workspaceToken, workspacePin, attendeeName) {
        this._consumeCallback("loading");

        this.socket.emit(
            "attend",
            {
                workspace: {
                    token: workspaceToken,
                    pin: workspacePin,
                },
                attendee: {
                    name: attendeeName,
                    avatar: "",
                },
                nonce: this._getNonce("attend-workspace"),
            }
        );
    };
    leaveWorkspace() {
        if (this.workspace.owner == this.attendee.id) {
            throw "Workspace owner cannot leave. Only shut down is allowed.";
        }

        //call the registered callback (app specific)
        this._consumeCallback("workspace-left");
        this._consumePluginCallback("workspace-left");

        //notify other attendees
        this.socket.emit(
            "leave",
            {
                workspace: {
                    id: this.workspace.id
                },
                attendee: this.attendee,
                accessToken: this.accessToken,
            }
        );

        //reset object(free resources)
        this._resetObject();
    };
    kickUser(attnd) {
        if (this.workspace.owner != this.attendee.id)
            return; //only owner can kick attendees
        
        //emit kick user event
        this.socket.emit(
            "kick",
            {
                workspace: {
                    id: this.workspace.id
                },
                attendee: {
                    id: attnd
                },
                accessToken: this.accessToken,
            }
        );
    };



    //
    // CALL MANAGEMENT
    //
    startCall() {
        if (!this.isOwner()) {
            //if not the owner... start call = join an existing call (if any)
            if (this.workspace && this.attendee) {
                this._restoreSession(); //restore joined workspace session
            }
            return;
        }
        //mark user as on call -> create call object (if there is no current call)
        if (!this.call || !this.call.id) {
            //no current ongoing call -> initialize
            this.call = {
                id: this._uuid(),
            };
        }
        this.call.camMode = "user" //by default use the front camera

        //create a video frame for local user ~ start video captutring -> this will be broadcasted to calee
        this._setupLocalVideoStream((stream) => {
            //
            // start calling each participant
            //
            
            //setup the p2p connection and attach to video streams(local + remote) - PREPARE OFFER(start p2p negotation)
            //--> unlike DOM creation, this function is called ONLY for remote attendant
            //--> one instance handles 2way communication(remote + local) ~ ONE PER ATTENDEE
            //IMPORTANT: call offer will be created
            for(let attnd in this.attendees) {
                console.log(attnd);
                if (!this.attendees[attnd].isOnCall) { //make sure the attendee is NOT already on call
                    //prepare offer for this attendee(set also the local description)
                    //handle also video DOM
                    this._setupVideoP2PConnection(
                        attnd,
                        stream,
                       (desc) => {
                            //all set! propagate `ring`
                            this.socket.emit(
                                "ring",
                                {
                                    workspace: {
                                        id: this.workspace.id
                                    },
                                    attendee: this.attendee, //caller
                                    accessToken: this.accessToken,
                                    call: {
                                        id: this.call.id,
                                    },
                                    callee: {
                                        id: attnd,
                                    },
                                    offer: desc,
                                    nonce: this._getNonce("start-call", this.call.id),
                                }
                            );
                        }
                    );
                }
            }
            //set a timeout - waiting for an answer and then hang up
            //ONLY IF THERE ARE MORE THAN ONE ATTENDEES - IF THERE IS ONLY ONE ATTENDEE, THEN ONLY THE HOST IS ON CALL
            //NO NEED FOR GARBAGE COLLECTION... PERHAPS PREPARING TO INVITE OTHERS
            if (this.attendees.length > 1)
                this.ringingTimeoutHnd = setTimeout(this._timedOutCallRingingGarbageCollector, this.awaitRingingBeforeHangUp);
            
            //call the registered callback (app specific)
            this._consumeCallback("call-started", this.attendee);
            this._consumePluginCallback("call-started", this.attendee);
        });
    };
    endCall() {
        //call the related registered callbacks to verify call termination (return: TRUE/FALSE)
        //DEPENDING ON the user's access (owner or attendee) call the appropriate callback
        const terminateStatus = this.isOnCall()
            && (this.isOwner() ? this._consumeCallback("terminate-call") : this._consumeCallback("leave-call"));
        if (terminateStatus) {            
            //all set! propagate `hangup`
            this.socket.emit(
                "hangup",
                {
                    workspace: {
                        id: this.workspace.id
                    },
                    attendee: this.attendee,
                    call: this.call,
                    accessToken: this.accessToken,
                }
            );

            this._hangUp(true);
        }
    };



    //
    // VIDEO STREAM MANAGEMENT
    //
    setMicState(state, attendeeID = null) {
        if (!attendeeID)
            attendeeID = this.attendee.id;
        const videoHolder = this._getVideoObjectDOM(attendeeID);
        if (videoHolder) {
            videoHolder.srcObject.getAudioTracks()[0].enabled = state;
        }
    };
    setCamState(state, attendeeID = null) {
        if (!attendeeID)
            attendeeID = this.attendee.id;
        const videoHolder = this._getVideoObjectDOM(attendeeID);
        if (videoHolder) {
            videoHolder.srcObject.getVideoTracks()[0].enabled = state;
        }
    };
    getCamMode() {
        return(this.call.camMode);
    }
    switchCam() {
        const mediaSuports = navigator.mediaDevices.getSupportedConstraints();
        if (!mediaSuports['facingMode'])
            return; //facingMode is not supported -> exit

        const videoHolder = this._getVideoObjectDOM(this.attendee.id);
        if (videoHolder) {
            this.call.camMode = this.call.camMode == "user" ? "environment" : "user";
            
            navigator.getWebcam = (navigator.getUserMedia || navigator.webKitGetUserMedia || navigator.moxGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
            const constraints = {
				video: {
					facingMode: this.call.camMode //set the default cam mode
				},
				audio: true,
			};
            if (navigator.mediaDevices.getUserMedia) {
				navigator.mediaDevices
				.getUserMedia(constraints)
				.then((mediaStream) => {
					//1. stop current streams
					videoHolder.srcObject.getTracks().forEach(track => {track.stop();});

					//2. attach new stream
					videoHolder.srcObject = mediaStream;

					//3. add new stream tracks
					const localVideoTrack = mediaStream.getVideoTracks()[0];
					for (let attnd in this.attendees) {
						let sender = this.attendees[attnd].videoP2PConn.getSenders().find((s) => {
							return (s.track.kind == videoTrack.kind);
						});
						sender.replaceTrack(localVideoTrack);
					}
				});
			}
			else {
				navigator.getWebcam(
					constraints, 
					(mediaStream) => {
						//1. stop current streams
						videoHolder.srcObject.getTracks().forEach(track => {track.stop();});

						//2. attach new stream
						videoHolder.srcObject = mediaStream;

						//3. add new stream tracks
						const localVideoTrack = mediaStream.getVideoTracks()[0];
						for (let attnd in this.attendees) {
							let sender = this.attendees[attnd].videoP2PConn.getSenders().find((s) => {
								return (s.track.kind == videoTrack.kind);
							});
							sender.replaceTrack(localVideoTrack);
						}
					}
				);
			}
        }
    };



    //
    // Messaging
    //
    sendMessage(type, data, toAttendee = null) {
        if (!this.isOnCall() || toAttendee == this.attendee.id)
            return; //cannot send if NOT on call OR to himself/herself
        
        const mObj = JSON.stringify(
            {
                type: type,
                data: data
            }
        );     
        if (toAttendee) {
            //send only to this attendee(only if is on call)
            if (this.attendees[toAttendee].isOnCall) {
                //is it open? If not put in buffer to send once connected
                if (this.attendees[toAttendee].dataChannel)
                    this.attendees[toAttendee].dataChannel.send(mObj);
                else
                    this.attendees[toAttendee].messageBuff.push(mObj);
            }
        }
        else {
            //send to ALL(participated in this call)
            for(let attnd in this.attendees) {
                if (this.attendees[attnd].isOnCall) {
                    //is it open? If not put in buffer to send once connected
                    if (this.attendees[attnd].dataChannel.send)
                        this.attendees[attnd].dataChannel.send(mObj);
                    else
                        this.attendees[attnd].messageBuff.push(mObj);
                }
            }
        }
    };



    //
    // "PRIVATE" METHODS
    //
    _resetObject(doHard = false) {
        //clear timeout handler(if any)
        if (this.ringingTimeoutHnd)
            clearTimeout(this.ringingTimeoutHnd);

        //remove all video frames + media streams(remote)
        for(let attnd in this.attendees) {
            this._removeAttendeeVideoStream(attnd);
            this.attendees[attnd].isOnCall = false; //mark attendee as not on call
        }

        //clear local video stream
        if (this.attendee)
            this._destroyLocalVideoStream();

        this.workspace = this._retrieveData("workspace");
        this.attendee = this._retrieveData("attendee");
        this.accessToken = this._retrieveData("accessToken");
        
        delete this.call;

        this.nonceSalt = this._uuid(10);

        if (doHard) {
            this.registeredCallbacks = {};
            this.plugins = [];
        }
    };
    _consumeCallback(evt, args) {
        let fn = null;
        if (typeof this.registeredCallbacks[evt] === "function") {
            const fn = this.registeredCallbacks[evt];
            return((typeof args === "undefined") ? fn() : fn(args));
        }
        return(fn);
    };
    _consumePluginCallback(evt, args) {
        let retVals = [];
        this.plugins.forEach((plugin) => {
            let pluginRetVal = this._consumeCallback(`${plugin}::${evt}`, args);
            if (pluginRetVal)
            retVals = retVals.concat(pluginRetVal);
        });
        return(retVals);
    };



    //
    // ATTENDEE HANDLING
    //
    _removeAttendeeVideoStream(attendeeID) {
        //stop any stream
        let vf = this._getVideoObjectDOM(attendeeID);
        if (vf && vf.srcObject) {
            vf.srcObject.getTracks().forEach(track => {track.stop();});
            delete vf.srcObject;
        }

        //remove any video stream(DOM)
        vf = this._getVideoFrameDOM(attendeeID);
        if (vf)
            vf.parentNode.removeChild(vf);
        
        //streams & p2p connections
        if (this.attendees[attendeeID]) {
            //clean datachanel
            if (this.attendees[attendeeID].dataChannel) {
                this.attendees[attendeeID].dataChannel.close();
                delete this.attendees[attendeeID].dataChannel;
            }

            //clean video p2p
            if (this.attendees[attendeeID].videoP2PConn) {
                this.attendees[attendeeID].videoP2PConn.close();
                delete this.attendees[attendeeID].videoP2PConn;
            }
        }            
    };
    _addAttendee(attendee) {
        if (attendee.id !== this.attendee.id) { //in case we try to add localhost, ignore
            //initialize attendee object
            const newAttnd = attendee;
            //register new attendee
            this.attendees[newAttnd.id] = newAttnd;
        }
    };
    _removeAttendee(attendeeID) {
        //stop and delete any stream media
        this._removeAttendeeVideoStream(attendeeID);
        //delete - remove from list
        delete this.attendees[attendeeID];
    };



    //
    // SIGNALING
    //
    _startPingingWorkspace(options) {
        //open connection to signaling server
        this.socket = io.connect(options.signalingServer);
        this.socket
            //
            // ICE events
            //
            .on("iceservers", (data) => {
                //STUN/TURN servers establishrd
                this.iceServers = data;
            })
            .on("icecandidate", (data) => {
                //register ice candidate
                if (this.attendees[data.broadcaster.id].videoP2PConn) {
                    //wait till connection object is defined
                    this.attendees[data.broadcaster.id].videoP2PConn.addIceCandidate(data.candidate);
                }
                else {
                    if (typeof this.attendees[data.broadcaster.id].iceCandidatesBuff === "undefined")
                        this.attendees[data.broadcaster.id].iceCandidatesBuff = [];
                    this.attendees[data.broadcaster.id].iceCandidatesBuff.push(data.candidate);
                }
            })
            .on("negotiation", (data) => {
                switch(data.message.type) {
                    case "offer":
                        //new offer -> accept & prepare answer
                        this._setNegotiationState(
                            data.attendee.id,
                           (desc) => {
                                //emit new negotitation
                                this.socket.emit(
                                    "negotiation", 
                                    {
                                        attendee: data.attendee,
                                        broadcaster: {
                                            id: this.attendee.id
                                        },
                                        workspace: {
                                            id: this.workspace.id
                                        },
                                        accessToken: this.accessToken,
                                        message: {
                                            type: "answer",
                                            data: desc,
                                        }
                                    }
                                );
                            },
                            data.message.data
                        );
                    break;
                    
                    case "answer":
                        //new video answer received => update local description
                        this.attendees[data.attendee.id].videoP2PConn
                        .setRemoteDescription(data.message.data)
                        .then(() => {
                            //nothing to dispatch back -> no emit(negotation completed)
                            //BUT once ICE negotiation is completed -> both local and remote descriptions are set
                            //start adding buffered ICE candidates(if any) - for the callee"s connection
                            if (typeof this.attendees[data.attendee.id].iceCandidatesBuff !== "undefined") {
                                this.attendees[data.attendee.id].iceCandidatesBuff.forEach((candt) => {
                                    this.attendees[data.attendee.id].videoP2PConn.addIceCandidate(candt);
                                });
                                delete this.attendees[data.attendee.id].iceCandidatesBuff;
                            }
                        })
                    break;
                };
            })
            //
            // webRTCWorkspaces events
            //
            //an error occured
            .on("alert", (data) => {
                //call loaded(in case loading has been previously called)
                this._consumeCallback("loaded");

                //call the registered callback (app specific)
                this._consumeCallback("alert", data);
            })
            //workspace created
            .on("created", (data) => {
                //update local instance
                this.workspace = data.workspace;
                this.attendee = data.attendee;
                this.accessToken = data.accessToken;

                //save data
                this._storeData("attendee", data.attendee);
                this._storeData("workspace", data.workspace);
                this._storeData("accessToken", data.accessToken);

                this._consumeCallback("loaded");

                //call the registered callback (app specific)
                this._consumeCallback("workspace-created", data);
                this._consumePluginCallback("workspace-created", data);
            })
            //workspace closed
            .on("destroyed", () => {
                //update storage
                this._deleteData("attendee");
                this._deleteData("accessToken");
                this._deleteData("workspace");

                //reset object(free resources)
                this._resetObject();

                this._consumeCallback("loaded");
                
                //call the registered callback (app specific)
                this._consumeCallback("workspace-destroyed");
                this._consumePluginCallback("workspace-destroyed");
            })
            .on("attendees", (data) => {
                this.attendees = {};
                for(let attnd in data.attendees) {
                    this._addAttendee(data.attendees[attnd]);
                };
            })
            //new user attended
            .on("attend", (data) => {
                this._addAttendee(data);

                //call the registered callback (app specific)
                this._consumeCallback("attendee-joined", data);
                this._consumePluginCallback("attendee-joined", data);

                //if the attendee is the owner & is on call invite the new attendee to join
                //if (this.isOnCall() && this.isOwner()) {
                if (this.isOnCall()) {
                    if (this.debug) {
                        console.log('I am on call starting a P2P call with new attendee...');
                        console.log('I am: ' + this.attendee.name);
                        console.log('New Attendee: ' + data.name);
                        console.log('------------------------------------------------------------------')
                    }
                    const localVideo = this._getVideoObjectDOM(this.attendee.id);
                    this._setupVideoP2PConnection(
                        data.id,
                        localVideo.srcObject,
                        (desc) => {
                            //all set! propagate `ring`
                            this.socket.emit(
                                "ring",
                                {
                                    workspace: {
                                        id: this.workspace.id
                                    },
                                    attendee: this.attendee, //caller
                                    accessToken: this.accessToken,
                                    call: this.call,
                                    callee: {
                                        id: data.id,
                                    },
                                    offer: desc,
                                    nonce: this._getNonce("start-call", this.call.id),
                                }
                            );
                        }
                    );
                }
            })
            //attendee left
            .on("leave", (data) => {
                if (data.id != this.attendee.id) {
                    //other attendee left
                    this._removeAttendee(data.id);
                    
                    //call the registered callback (app specific)
                    this._consumeCallback("attendee-left", data);
                    this._consumePluginCallback("attendee-left", data);
                }
                else {
                    //I have been kicked by host -> terminate & reset data
                    this._deleteData("attendee");
                    this._deleteData("accessToken");
                    this._deleteData("workspace");

                    //call the registered callback (app specific)
                    this._consumeCallback("workspace-left");
                    this._consumePluginCallback("workspace-left");

                    //reset object(free resources)
                    this._resetObject();
                }
            })
            //acceess to workspace is granted
            .on("attendance-granted", (data) => {
                this.workspace = data.workspace;
                this.attendee = data.attendee;
                this.accessToken = data.accessToken;

                //save data
                this._storeData("attendee", data.attendee);
                this._storeData("workspace", data.workspace);
                this._storeData("accessToken", data.accessToken);

                //add other attendees
                for(let attnd in data.attendees) {
                    this._addAttendee(data.attendees[attnd]);
                };

                this._consumeCallback("loaded");
                
                //call the registered callback (app specific)
                this._consumeCallback("workspace-joined", data);
                this._consumePluginCallback("workspace-joined", data);
            })
            //session restored
            .on("re-attendance-granted", (data) => {
                 //save data
                this._storeData("attendee", data.attendee);
                this._storeData("workspace", data.workspace);
                this._storeData("accessToken", data.accessToken);
                
                //add other attendees
                for(let attnd in data.attendees) {
                    this._addAttendee(data.attendees[attnd]);
                };

                this._consumeCallback("loaded");

                //create a video frame for the current user
                this._createVideoFrame(this.attendee);
                
                //call the registered callback (app specific)
                this._consumeCallback("workspace-joined", data);
                this._consumePluginCallback("workspace-joined", data);

                //final step... is there an ongoing call? re-start
                if (data.call) {
                    if (this.debug) {
                        console.log('A call already found for this workspace. Restart...');
                        console.log('Call ID: ' + data.call                              );
                        console.log('---------------------------------------------------');
                    }

                    this.call = {
                        "id" :data.call,
                    };
                    this.startCall();
                }
            })
            //receiving this event means that someone has started a call -> p2p negotation
            //accept here the call -> do the appropriate rendering(video objects) and complete p2p negotation(answer)
            .on("ring", (data) => {
                if (this.debug) {
                    console.log('RING event received...');
                    console.log('Am I on Call? - ' + (this.isOnCall() ? 'YES' : 'NO'));
                    console.log(data);
                    console.log('----------------------------------------');
                }

                if (!this.isOnCall()) {
                    //mark user as on call(temporarly - will delete if not accept the call)
                    this.call = data.call;
                    this.call.facingMode = "user"; //by default use front camera
                }

                //IMPORTANT: If already on the same call AUTO accept incoming call requests
                //           OTHERWISE, call the registered callback (app specific) to accept/reject the call
                //           BUT ONLY IF THE REQUEST COMES FROM THE CALL OWNER
                let answerStatus = this.isOnCall(data.call.id);
                if (data.call.id == this.workspace.owner) {
                    answerStatus = !this.isOnCall() || this._consumeCallback("ringing", data.caller);
                }
                if (answerStatus) {
                    //call accepted ~ no need for p2p negotation

                    //create a video frame for local user ~ start video captutring -> this will be broadcasted to caller
                    this._setupLocalVideoStream((stream) => {
                        //prepare answer for the caller(set also the local description)
                        this._setupVideoP2PConnection(
                            data.caller.id,
                            stream,
                            (desc) => {
                                //mark caller as on call
                                this.attendees[data.caller.id].isOnCall = true;

                                //all set! propagate `answer`
                                if (this.debug) {
                                    console.log('I am emitting now an ANSWER event as a response to RING event...');
                                    console.log('I am ' + this.attendee.name);
                                    console.log('Caller ' + data.caller.name);
                                    console.log('----------------------------------------');
                                }                                
                                this.socket.emit(
                                    "answer",
                                    {
                                        workspace: data.workspace,
                                        attendee: this.attendee, //callee
                                        call: data.call,
                                        caller: {
                                            id: data.caller.id,
                                        },
                                        answer: desc,
                                        accessToken: this.accessToken,
                                        nonce: data.nonce,
                                    }
                                );

                                //once ICE negotiation is completed -> both local and remote descriptions are set
                                //start adding buffered ICE candidates(if any) - for the caller"s connection
                                if (typeof this.attendees[data.caller.id].iceCandidatesBuff !== "undefined") {
                                    this.attendees[data.caller.id].iceCandidatesBuff.forEach((candt) => {
                                        this.attendees[data.caller.id].videoP2PConn.addIceCandidate(candt);
                                    });
                                    delete this.attendees[data.caller.id].iceCandidatesBuff;
                                }

                                //call the registered callback (app specific)
                                this._consumeCallback("call-started", this.attendee);
                                this._consumePluginCallback("call-started", this.attendee);

                                //call the registered callback (app specific)
                                this._consumeCallback("call-accepted", data.caller);
                                this._consumePluginCallback("call-accepted", data.caller);
                            },
                            data.offer //initialize with offer
                        );
                    });
                }
                else {
                    //call rejected ~ no need for p2p negotation
                    delete this.call; //mark user as not on call
                    this.socket.emit(
                        "busy",
                        {
                            workspace: data.workspace,
                            attendee: this.attendee, //callee
                            call: data.call,
                            caller: {
                                id: data.caller.id,
                            },
                            accessToken: this.accessToken,
                            nonce: data.nonce,
                        }
                    );
                }
            })
            //receiving this event means that someone has accepted the call -> p2p negotation
            //complete the p2p negotation and do the appropriate rendering(video objects)
            .on("answer", (data) => {
                if (this.debug) {
                    console.log('ANSWER event received...');
                    console.log(data);
                    console.log('----------------------------------------');
                }
                if (this.isOnCall(data.call.id)) { //make sure to tackle late received messages(async) - if not onCall ignore
                    //complete p2p negotation - call answered -> set the remote description(for those attendees replied)
                    //
                    //IMPORTANT: Before assigning the remote decription make sure the p2p connection
                    //           is NOT terminated by garbage collector(_timedOutCallRingingGarbageCollector)
                    //           [In case of late socket event received AFTER resources cleaned]
                    if (this.attendees[data.callee.id].videoP2PConn) {
                        this.attendees[data.callee.id].videoP2PConn
                        .setRemoteDescription(data.answer)
                        .then(() => {
                            //mark attendee as on call
                            this.attendees[data.callee.id].isOnCall = true;

                            //once ICE negotiation is completed -> both local and remote descriptions are set
                            //start adding buffered ICE candidates(if any) - for the callee"s connection
                            if (typeof this.attendees[data.callee.id].iceCandidatesBuff !== "undefined") {
                                this.attendees[data.callee.id].iceCandidatesBuff.forEach((candt) => {
                                    this.attendees[data.callee.id].videoP2PConn.addIceCandidate(candt);
                                });
                                delete this.attendees[data.callee.id].iceCandidatesBuff;
                            }
                        });
                    }
                    
                    //call the registered callback (app specific)
                    this._consumeCallback("call-accepted", data.callee);
                    this._consumePluginCallback("call-accepted", data.callee);
                }
            })
            //attendee is on another call
            .on("busy", (data) => {
                if (this.isOnCall(data.call.id)) { //make sure to tackle late received messages(async) - if not onCall ignore
                    if (this.attendees.length == 1) {
                        //in case we are calling ONLY one callee -> busy => end call
                        //terminate call
                        this._hangUp(true);
                    }

                    //call the registered callback (app specific)
                    this._consumeCallback("busy", data.callee);
                    this._consumePluginCallback("busy", data.callee);
                }
            })
            //cal ended
            .on("hangup", (data) => {
                if (this.isOnCall(data.call.id)) { //make sure to tackle late received messages(async) - if not onCall ignore
                    if (data.attendee.id == this.workspace.owner)
                        this._hangUp(true);
                    else
                        this._hangUpAttendee(data.attendee.id);

                    this._consumeCallback("call-ended");
                    this._consumePluginCallback("call-ended");
                }
            })
            //attendee is on another call
            .on("full", () => {
                //call the registered callback (app specific)
                this._consumeCallback("workspace-is-full");
                this._consumePluginCallback("workspace-is-full");
            })
        ;
    };



    //
    // CALL MANAGEMENT
    //
    _hangUp(doCallback) {
        if (this.debug) {
            console.log("Hang up is called. Terminating call.");
        }

        //clear timeout handler(if any)
        if (this.ringingTimeoutHnd)
            clearTimeout(this.ringingTimeoutHnd);

        //remove all video frames + media streams(remote)
        for(let attnd in this.attendees) {
            this._removeAttendeeVideoStream(attnd);
            this.attendees[attnd].isOnCall = false; //mark attendee as not on call
        }

        //remove all video frames + media streams(local)
        this._destroyLocalVideoStream();

        //mark user as not on call
        delete this.call;

        //call the registered callback (app specific)
        if (doCallback) {
            this._consumeCallback("call-ended");
            this._consumePluginCallback("call-ended");
        }
    };
    _hangUpAttendee(attendeeID) {
        //remove all video frames + media streams(remote)
        this._removeAttendeeVideoStream(attendeeID);
        if (this.attendees[attendeeID]) //handle events ~ user might have left
            this.attendees[attendeeID].isOnCall = false; //mark attendee as not on call
    };



    //
    // SESSION HANDLING
    //
    _restoreSession() {
        this._consumeCallback("loading");

        //restore joinded workspace session
        this.socket.emit(
            "re-attend",
            {
                workspace: this.workspace,
                attendee: this.attendee,
                accessToken: this._retrieveData("accessToken"),
            }
        );
    };



    //
    // STORAGE HANDLING
    //
    _storeData(keyword, data) {
        if (this.doStorage)
            window.localStorage.setItem(keyword, JSON.stringify(data));
    };
    _retrieveData(keyword) {
        const data = window.localStorage.getItem(keyword);
        return(data ? JSON.parse(data) : null);
    };
    _deleteData(keyword) {
        window.localStorage.removeItem(keyword);
    };



    //
    // CALL UTIL FUNCTIONS
    //
    _getVideoFrameDOM(attendeeID) {
        return(document.getElementById(`${attendeeID}-video-frame`));
    };
    _getVideoCanvasDOM(attendeeID) {
        return(document.querySelector(`#${attendeeID}-video-frame\\:video-canvas`));
    };
    _getVideoObjectDOM(attendeeID) {
        return(document.querySelector(`#${attendeeID}-video-frame\\:video-object`));
    };
    _createVideoFrame(attendee) {
        //create a video frame(DOM - use callback renderer) to hold the video stream 
        //(that will be atached later, once the p2p connection is established)
        const args = {
            attendee: attendee,
            muteState: attendee.id == this.attendee.id, //in case a video frame for local host is created mute it
            camState: true, 
        };
        const videoHolder = this._consumeCallback("video-frame-render", args);
        if (!videoHolder)
            throw "Cannot create the video DOM object to hold remote video stream. Abort.";

        //
        // once video frame is rendered check for plugin addons
        //
        const videoCanvas = this._getVideoCanvasDOM(attendee.id);
        if (!videoCanvas)
            throw "Video frame DOM is not detected. Cannot append plugins. Abort.";
        const pluginVideoFrameAddOns = this._consumePluginCallback("video-frame-render", args);
        pluginVideoFrameAddOns.forEach(addon => videoCanvas.appendChild(addon));

        return(videoHolder);
    };
    _setupLocalVideoStream(cb) {
        //Create DOM
        const videoHolder = this._createVideoFrame(this.attendee);
        if (!videoHolder)
            throw "Cannot create the video DOM object to hold remote video stream. Abort.";

        navigator.getWebcam = (navigator.getUserMedia || navigator.webKitGetUserMedia || navigator.moxGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
        const constraints = {
			video: {
				facingMode: this.call.camMode //set the default cam mode
			},
			audio: true,
		};
        if (navigator.mediaDevices.getUserMedia) {
			//open video stream from webcam and attach
			navigator.mediaDevices
			.getUserMedia(constraints)
			.then((mediaStream) => {
				videoHolder.srcObject = mediaStream;
				cb(mediaStream);
			});
		}
		else {
			navigator.getWebcam(
				constraints, 
				(mediaStream) => {
					videoHolder.srcObject = mediaStream;
					cb(mediaStream);
				}
			);
		}
    };
    _destroyLocalVideoStream() {
        let vf = this._getVideoObjectDOM(this.attendee.id);
        if (vf && vf.srcObject) {
            vf.srcObject.getTracks().forEach(track => {track.stop();});
            delete vf.srcObject;
        }

        //remove any video stream(DOM)
        vf = this._getVideoFrameDOM(this.attendee.id);
        if (vf)
            vf.parentNode.removeChild(vf);
    };
    _setupVideoP2PConnection(attendeeID, localStream, cb, initWithOffer = null) {
        //
        // IMPORANT: IF initWithOffer is null THEN initialize localDescription with an offer
        //           In other words, if initWithOffer is provided, assume p2p delgation started
        //           and prepare the connection to complete the negotation(i.e. prepare answer for received offer)
        //

        //setup a p2p connection with this attendee
        if (!this.iceServers) {
            //make sure we have a valid STUN/TURN list
            throw "ICE Servers list is not initialized.";
        }

        //initialize ICE Candidates buffer
        this.attendees[attendeeID].videoP2PConn = new RTCPeerConnection({
            iceServers: this.iceServers,
        });
        
        //create a video frame for remote stream
        this._createVideoFrame(this.attendees[attendeeID]);

        //attach local video streaming to remote connection
        localStream.getTracks().forEach((track) => {
            this.attendees[attendeeID].videoP2PConn.addTrack(track, localStream);
        });

        //handle events
        this.attendees[attendeeID].videoP2PConn
            .onicecandidate =(evt) => {
                if (evt.candidate && evt.candidate !== "") {
                    //delegation is on going - exchange ICE clients
                    this.socket.emit(
                        "icecandidate", {
                            attendee: {
                                id: attendeeID,
                            },
                            broadcaster: {
                                id: this.attendee.id
                            },
                            workspace: {
                                id: this.workspace.id
                            },
                            accessToken: this.accessToken,
                            candidate: evt.candidate
                        }
                    );
                }
            };
        this.attendees[attendeeID].videoP2PConn
            .ontrack =(evt) => {
                //attach video DOM to remote video streaming
                const videoHolder = this._getVideoObjectDOM(attendeeID); //videoHolder = remote video
                if (videoHolder.srcObject)
                    return; //no need to reset if already set
                videoHolder.srcObject = evt.streams[0];
            };
        this.attendees[attendeeID].videoP2PConn
            .oniceconnectionstatechange =() => {
                //if connection is lost ~ emmit an event to terminate call
                switch(this.attendees[attendeeID].videoP2PConn.iceConnectionState) {
                    case "disconnected":
                    case "failed":
                        if (this.isOwner()) {
                            //restart negotiation with the peer => Offer(only the caller)
                            this._setNegotiationState(
                                attendeeID,
                               (desc) => {
                                    //emit new negotitation
                                    this.socket.emit(
                                        "negotiation", 
                                        {
                                            attendee: {
                                                id: attendeeID,
                                            },
                                            broadcaster: {
                                                id: this.attendee.id
                                            },
                                            workspace: {
                                                id: this.workspace.id
                                            },
                                            accessToken: this.accessToken,
                                            message: {
                                                type: "offer",
                                                data: desc,
                                            }
                                        }
                                    );
                                }
                            );
                        }
                    break;
                };
            };
        this.attendees[attendeeID].videoP2PConn
            .ondatachannel =(evt) => {
                //a data channel is created by the remote peer - add local too
                this._setupDataChannel(attendeeID, evt.channel);
            };
        
        if (initWithOffer) {
            //prepare the p2p negotation for accepting the call - answer(based on input offer -> remote description can also be set)
            this.attendees[attendeeID].videoP2PConn
            .setRemoteDescription(initWithOffer)
            .then(() => {
                this.attendees[attendeeID].videoP2PConn
                .createAnswer()
                .then((desc) => {
                    this.attendees[attendeeID].videoP2PConn
                    .setLocalDescription(desc)
                    .then(() => {
                        cb(desc);
                    });
                })
            });
        }
        else {
            //before creating the offer initialize the data channel
            this._setupDataChannel(attendeeID);

            //prepare the p2p negotation for starting the call - offer
            this.attendees[attendeeID].videoP2PConn
            .createOffer()
            .then((desc) => {
                this.attendees[attendeeID].videoP2PConn
                .setLocalDescription(desc)
                .then(() => {
                    cb(desc);
                });
            });
        }
    };
    _setNegotiationState(attendeeID, cb, initWithOffer = null) {
        // ICE Connection has failed -> Restarting the negotiation process
        // => New offer & New answer
        // IMPORTANT: No need to redefine p2p connection
        if (!this.iceServers) {
            //make sure we have a valid STUN/TURN list
            throw "ICE Servers list is not initialized.";
        }

        if (initWithOffer) {
            //prepare the p2p negotation for accepting the call - answer(based on input offer -> remote description can also be set)
            this.attendees[attendeeID].videoP2PConn
            .setRemoteDescription(initWithOffer)
            .then(() => {
                this.attendees[attendeeID].videoP2PConn
                .createAnswer()
                .then((desc) => {
                    this.attendees[attendeeID].videoP2PConn
                    .setLocalDescription(desc)
                    .then(() => {
                        cb(desc);
                    });
                })
            });
        }
        else {
            //prepare the p2p negotation for starting the call - offer
            this.attendees[attendeeID].videoP2PConn
            .createOffer()
            .then((desc) => {
                this.attendees[attendeeID].videoP2PConn
                .setLocalDescription(desc)
                .then(() => {
                    cb(desc);
                });
            });
        }
    };
    _setupDataChannel(attendeeID, initWithChannel = null) {
        //setup data channel(once the Connection is created)
        if (!this.attendees[attendeeID].videoP2PConn) {
            throw "P2P Connection is not initialized.";
        }

        if (initWithChannel)
            this.attendees[attendeeID].dataChannel = initWithChannel;
        else
            this.attendees[attendeeID].dataChannel = this.attendees[attendeeID].videoP2PConn.createDataChannel(this.call.id);

        this.attendees[attendeeID].messageBuff = [];
        this.attendees[attendeeID].dataChannel
            .onmessage =(evt) => {
                //new message received -> parse and call the related callback (plugins)
                //MAKE SURE IS A VALID PLUGIN EVENT => is of the form <PLUGIN NAME>::<EVENT>
                const msg = JSON.parse(evt.data);
                const parsedEvtType = msg.type.split("::",1);
                if (this.plugins.indexOf(parsedEvtType[0]) !== -1) {
                    //prefix is a valid registered plugin -> call callback
                    this._consumeCallback(msg.type, msg.data);
                }
            };
        this.attendees[attendeeID].dataChannel
            .onopen =() => {
                //now call procedure is completed - p2p connection is established AND data channel
                if (this.isOnCall()) {
                    //if is on call then now the negotiation is completed -> we can call the registered callbacks
                    this._consumeCallback("call-completed", this.attendees[attendeeID]);
                    this._consumePluginCallback("call-completed", this.attendees[attendeeID]);
                }

                //connection established -> send buffered messages
                this.attendees[attendeeID].messageBuff.forEach((msg) => {
                    this.attendees[attendeeID].dataChannel.send(msg);
                });
                this.attendees[attendeeID].messageBuff = [];
            };      
    };

    _timedOutCallRingingGarbageCollector() {
        //remove connections started with attendeed that did not answer the call(timed out)
        //IMPORTANT: This function is different to hangup!!!!
        //It will deal with unanswered calls in case some of the attendees accept the call
        //On contrary, hangup assumes NOONE replys and cleans everything
        
        //IMPORTANT: Access this like thisRef for disambiguation
        const thisRef = window.webRTCWorkspaces;

        if (this.debug) {
            console.log('Ringing timeout....');
        }
        
        let hasAnswered = false;
        for(let attnd in this.attendees) {
            if (thisRef.attendees[attnd].videoP2PConn && !thisRef.attendee[attnd].isOnCall) {
                thisRef._removeAttendeeVideoStream(attnd);
                thisRef.attendee[attnd].isOnCall = false; //mark attendee as not on call
            }
            else {
                hasAnswered = true;
                break; //call is on progress -> no need to further check
            }
        }
        if (!hasAnswered) {
            //remove all video frames + media streams(local)
            thisRef._destroyLocalVideoStream();
            thisRef._consumeCallback("call-ended"); //call the app specific registered event
            thisRef._consumePluginCallback("call-ended");
        }
    };



    //
    // OTHER UTIL FUNCTIONS
    //
    _uuid(length = 7) {
        let result = "";
        let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for(let i = 0; i<length; i++)
           result += characters.charAt(Math.floor(Math.random() * characters.length));
        return(result);
    };
    _getNonce(action = "", prefix = "") {
         return(`${action}:${prefix}:${this.nonceSalt}`);
    };
    verifyNonce(nonce) {
         return(this.nonceSalt == nonce);
    };
};