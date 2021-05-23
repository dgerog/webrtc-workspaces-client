"use strict";
// function to load the theme (in the index file)
function webRTCWorkspacesInitClient(themeClass) {
    //
    // Define theme routing
    //    
    window.addEventListener('hashchange', () => { 
        const nextRoute = window.location.hash.substr(1);
        const currentRouteDOM = document.querySelector(".active-route");
        if (!nextRoute || !currentRouteDOM)
            return;
        if (nextRoute == currentRouteDOM.id) //if navigate to the same route - return
            return;
        const nextRouteDOM = document.getElementById(nextRoute);
        //hide current view
        currentRouteDOM.classList.remove('active-route');
        currentRouteDOM.classList.add('hide');
        //show next view
        nextRouteDOM.classList.remove('hide');
        nextRouteDOM.classList.add('active-route');
    });

    //
    // LOAD THEME VIEWS
    //
    //create a style element to load the themeing styles
    window.addEventListener('DOMContentLoaded', (event) => {
        //add theme stylesheet
        let style = null;
        themeClass.getCSSUri().forEach(uri => {
            style = document.createElement('link');
            style.setAttribute('rel', 'stylesheet');
            style.setAttribute('href', uri);
            document.getElementsByTagName('head')[0].appendChild(style);
        });

        //add theme JS
        let js = null;
        themeClass.getJSUri().forEach(uri => {
            js = document.createElement('script');
            js.setAttribute('src', uri);
            document.getElementsByTagName('head')[0].appendChild(js);
        });

        //draw the workspace canvas (this will remove any other code previously added in the BODY dom element)
        document.getElementsByTagName('body')[0].innerHTML = themeClass.renderCanvas();

        //export controlers
        js = document.createElement('script');
            js.innerHTML = themeClass.exportControllers();
        document.getElementsByTagName('body')[0].appendChild(js);
    });
    
    //
    // REGISTER THE RELATED webRTCWorkspaces RENDERING CALLBACKS (=> TEMPLATE PARTS DEFINITION)
    //
    //rendering a video frame (for an attendee during a call)
    window.webRTCWorkspaces.registerCallback(
        ['video-frame-render'],
        (args) => {
            //   Create the video object to hold the video stream - used in `ring` & `answer` events
            //   IMPORTANT: `webRTCWorkspacesVideoFrames` MUST be the id of the div elements that will
            //               hold ALL video frames.
            //RETURNS an object with the new video object
            //check if already created ~ in that case simply return current DOM object
            let vf = document.querySelector('#' + args.attendee.id + '-video-frame\\:video-object');
            if (window.webRTCWorkspaces.debug) {
                console.log('Video Frame Renderer Called...');
                console.log('Create New Video Object :' + (vf ? 'NO' : 'YES'));
                console.log('Attendee Name:' + args.attendee.name);
                console.log(args);
                console.log('--');
            }
            if (vf) {
                //exists ~ simply return current instance
                return (vf);
            }
            else {
                //1. does not exist ~ create & append
                vf = document.createElement('div');
                    vf.id = args.attendee.id + "-video-frame"; //IMPORTANT: ID should follow this format!!!!
                    vf.className = "video-frame";
                    vf.innerHTML = themeClass.renderVideoFrame(args);
                document.getElementById('webRTCWorkspacesVideoFrames').appendChild(vf);
                
                //a new video frame is created - redraw to adapt the width & height
                if (typeof redrawVideoFrames === "function")
                    redrawVideoFrames();

                return (document.querySelector('#' + args.attendee.id + '-video-frame\\:video-object'));
            }
        }
    );

    //handle an alert (error)
    window.webRTCWorkspaces.registerCallback(
        ['alert'],
        (message) => {
            themeClass.doAlert(message);
        }
    );

    //a call is started
    window.webRTCWorkspaces.registerCallback(
        ['call-started'],
        (attendee) => {
            // callback - any time a call is started

        }
    );

    //call has been answered by an attendee
    window.webRTCWorkspaces.registerCallback(
        ['call-accepted'],
        (attendee) => {
            
        }
    );

    //call is terminated
    window.webRTCWorkspaces.registerCallback(
        ['call-ended'],
        () => {
            //a new video frame is created - redraw to adapt the width & height
            if (typeof redrawVideoFrames === "function")
                redrawVideoFrames();            
        }
    );

    //calling circle is completed
    window.webRTCWorkspaces.registerCallback(
        ['call-completed'],
        (attendee) => {
            const elem = document.getElementById('video-frame-ringing-' + attendee.id);
            if (elem)
                elem.parentNode.removeChild(elem);
        }
    );

    //ringing - someone has called this user
    //--> Control wheather to accept the call or not
    //    Return TRUE (accept the call) / FALSE (reject the call)
    window.webRTCWorkspaces.registerCallback(
        ['ringing'],
        (caller) => {
            const _ans = window.confirm('Incoming call from ' + caller.name + '. Accept?');
            return (_ans);
        }
    );

    //terminating a call
    //--> Confirm call termination
    //    Return TRUE (terminate) / FALSE (ignore)
    window.webRTCWorkspaces.registerCallback(
        ['terminate-call'],
        () => {
            //no confirmation -> return true
            return (true);
        }
    );

    //leave a call
    //--> Confirm call termination
    //    Return TRUE (terminate) / FALSE (ignore)
    window.webRTCWorkspaces.registerCallback(
        ['leave-call'],
        () => {
            //no confirmation -> return true
            return (true);
        }
    );

    //busy - call declined by callee
    window.webRTCWorkspaces.registerCallback(
        ['busy'],
        (callee) => {
            themeClass.doAlert(callee.name + ' is busy :-(');
        }
    );

    //an attendee has joined
    window.webRTCWorkspaces.registerCallback(
        ['attendee-joined'],
        (attendee) => {
            themeClass.doAlert(attendee.name + " joined the workspace.", false);
            //a new video frame is created - redraw to adapt the width & height
            if (typeof redrawVideoFrames === "function")
                redrawVideoFrames();

            //play sound
            if (window.canPlaySound) {
                const audioElem = document.querySelector('#joinSnd');
                audioElem && audioElem.play();
            }
        }
    );

    //an attendee has left
    window.webRTCWorkspaces.registerCallback(
        ['attendee-left'],
        (attendee) => {
            themeClass.doAlert(attendee.name + " left the workspace.", false);
            //a video frame is removed - redraw to adapt the width & height
            if (typeof redrawVideoFrames === "function")
                redrawVideoFrames(); 
            
            //play sound
            if (window.canPlaySound) {
                const audioElem = document.querySelector('#leftSnd');
                audioElem && audioElem.play();
            }
        }
    );

    //an attendee was kicked by admin
    window.webRTCWorkspaces.registerCallback(
        ['attendee-kicked'],
        (attendee) => {
            if (attendee.iWasKicked) {
                themeClass.doAlert("You were kicked out by the admin.", false);
                
                //play sound
                if (window.canPlaySound) {
                    const audioElem = document.querySelector('#kickedSnd');
                    audioElem && audioElem.play();
                }                
                
                //move to welcome route
                window.location.hash = 'welcome';
            }
            else {
                themeClass.doAlert(attendee.name + " kicked out by the admin.");
                //a video frame is removed - redraw to adapt the width & height
                if (typeof redrawVideoFrames === "function")
                    redrawVideoFrames();
            }
        }
    );

    //an new workspace is created
    window.webRTCWorkspaces.registerCallback(
        ['workspace-created'],
        (data) => {
            //move to workspace route
            window.location.hash = 'workspace';

            //play sound
            if (window.canPlaySound) {
                const audioElem = document.querySelector('#joinSnd');
                audioElem && audioElem.play();
            }

            setTimeout(() => {
                //set a delay to load the route - give some time for page rendering and then, start the call 
                window.webRTCWorkspaces.startCall();

                //reset mic & ca status to default (BOTH TRUE!!!!!)
                themeClass.toggleMic && themeClass.toggleMic(true); //make sure toggleMic is implemented 
                themeClass.toggleCam && themeClass.toggleCam(true); //make sure toggleCam is implemented
            }, 500);
        }
    );

    //accepted to join the workspace
    window.webRTCWorkspaces.registerCallback(
        ['workspace-joined'],
        (data) => {
            //play sound
            if (window.canPlaySound) {
                const audioElem = document.querySelector('#joinSnd');
                audioElem && audioElem.play();
            }

            //move to workspace route
            window.location.hash = 'workspace';
        }
    );

    //workspace destroyed
    window.webRTCWorkspaces.registerCallback(
        ['workspace-destroyed'],
        () => {
            themeClass.doAlert('This workspace is terminated by the administrator.', false);
            
            //play sound
            if (window.canPlaySound) {
                const audioElem = document.querySelector('#shutdownSnd');
                audioElem && audioElem.play();
            }

            //move to welcome route
            window.location.hash = 'welcome';
        }
    );

    //left the workspace
    window.webRTCWorkspaces.registerCallback(
        ['workspace-left'],
        () => {
            //move to welcome route
            window.location.hash = 'welcome';

            //play sound
            if (window.canPlaySound) {
                const audioElem = document.querySelector('#shutdownSnd');
                audioElem && audioElem.play();
            }            
        }
    );

    //loading process
    window.webRTCWorkspaces.registerCallback(
        ['loading'],
        () => {
            themeClass.doLoading();
        }
    );

    //process loaded
    window.webRTCWorkspaces.registerCallback(
        ['loaded'],
        () => {
            themeClass.doLoaded();
        }
    );

    //full - cannot attend
    window.webRTCWorkspaces.registerCallback(
        ['workspace-is-full'],
        () => {
            themeClass.doAlert("Workspace if full! Cannot join.");
            //workspace is full -> reroute back to index page
            window.location.hash = 'welcome';
        }
    );

    //handle mic/cam state changes
    window.webRTCWorkspaces.registerCallback(
        ['toggle-mic-state'],
        (data) => {
            !data.state ? $('#mic-off-' + data.attnd).show() : $('#mic-off-' + data.attnd).hide();
        }
    );
    window.webRTCWorkspaces.registerCallback(
        ['toggle-cam-state'],
        (data) => {
            !data.state ? $('#cam-off-' + data.attnd).show() : $('#cam-off-' + data.attnd).hide();
        }
    );
}