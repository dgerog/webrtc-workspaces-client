"use strict";

/**
 * Define the theme class
 */
class webRTCWorkspacesTheme {
    // CSS URIs
    getCSSUri() {
        /* 
            IMPORTANT: Styles will be added in this order -> The later file will
            replace the earlier in the append order.
        */
        return([
            "https://cdn.jsdelivr.net/npm/bootstrap@5.0.1/dist/css/bootstrap.min.css",
            "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.2/css/all.min.css",
            "webrtc-workspaces-lib/theme/default/default.css",
        ]);
    };

    // JS URIs
    getJSUri() {
        /* 
            IMPORTANT: Scripts will be added in this order -> The later file will
            replace the earlier in the append order.
        */
        return([
            "https://code.jquery.com/jquery-3.5.1.slim.min.js",
            "https://cdn.jsdelivr.net/npm/bootstrap@5.0.1/dist/js/bootstrap.bundle.min.js",
        ]);
    };

    //
    // Controllers
    //
    exportControllers() {
        return (
            `
                const currentOnLoadFunc = window.onload;
                window.onload = () => {
                    //make sure to execute any current onload function
                    currentOnLoadFunc && currentOnLoadFunc();

                    //initialize workspace access token (if any)
                    const urlParams = new URLSearchParams(window.location.search);
                    const wsToken = urlParams.get('ws');
                    if (wsToken) {
                        $('#join-ws-token').val(wsToken);
                        showJoinForm();
                    }

                    //load default route
                    window.location.hash = 'welcome';
                };

                createWorkspace = () => {
                    //validate
                    const createWSName = $('#create-ws-name').val();
                    const  createAttndName= $('#create-attnd-name').val();
                    const createWSPin = $('#create-ws-pin').val();
                    if (!createWSName.length) {
                        alert('Please enter a workspace name.');
                        $('#create-ws-name').focus();
                        return;
                    }
                    if (createWSPin.length && createWSPin.length != 5) {
                        alert('Please enter a 5 characters PIN.');
                        $('#create-ws-pin').focus();
                        return;
                    }
                    if (!createAttndName.length) {
                        alert('Please enter your name.');
                        $('#create-attnd-name').focus();
                        return;
                    }

                    //all good - create workspace
                    window.webRTCWorkspaces.createWorkspace(
                        createWSName,
                        createWSPin,
                        createAttndName
                    );
                };
                joinWorkspace = () => {
                    //validate
                    const joinWSToken = $('#join-ws-token').val();
                    const  joinAttndName= $('#join-attnd-name').val();
                    const joinWSPin = $('#join-ws-pin').val();
                    if (!joinWSToken.length || joinWSToken.length <= 50) {
                        alert('Please enter a valid workspace token.');
                        $('#join-ws-token').focus();
                        return;
                    }
                    if (joinWSPin.length && joinWSPin.length != 5) {
                        alert('Please enter a 5 characters PIN.');
                        $('#join-ws-pin').focus();
                        return;
                    }
                    if (!joinAttndName.length) {
                        alert('Please enter your name.');
                        $('#create-attnd-name').focus();
                        return;
                    }

                    //all good - join the workspace
                    window.webRTCWorkspaces.joinWorkspace(
                        joinWSToken,
                        joinWSPin,
                        joinAttndName
                    );
                };
                destroyWorkspace = () => {
                    if (window.webRTCWorkspaces.isOwner()) {
                        if (confirm('This will end your call and destroy this workspace permanently. Proceed?')) {
                            window.webRTCWorkspaces.destroyWorkspace();
                        }
                    }
                    else {
                        if (confirm('Exit this workspace? While it is active, you can join it again.')) {
                            window.webRTCWorkspaces.leaveWorkspace();
                        }
                    }
                };
                shareCall = () => {
                    const ws = window.webRTCWorkspaces.getWorkspace();
                        $('#wsToken').val(window.location.origin + window.location.pathname + '?ws=' + ws.token);
                    const elem = $('#wsToken');
                        elem.select();
                        if (elem.setSelectionRange)
                            elem.setSelectionRange(0, 99999);
                    document.execCommand("copy");
                    if (window.webRTCWorkspaces.debug) {
                        console.log('Workspace Invitation URL');
                        console.log($('#wsToken').val());
                        console.log('--');
                    }                    
                    alert("Workspace access URL copied. Share it with your favorite app.");
                };

                toggleMic = (state) => {
                    if (window.webRTCWorkspaces.debug) {
                        console.log('Mic toggle for local. New state is ' + (state ? 'ON' : 'OFF'));
                    }
                    window.webRTCWorkspaces.setMicState(state);
                    if (state) {
                        $('#btn-call-mic-on').removeClass('hide');
                        $('#btn-call-mic-off').addClass('hide');
                    }
                    else {
                        $('#btn-call-mic-on').addClass('hide');
                        $('#btn-call-mic-off').removeClass('hide');
                    }
                };

                toggleCam = (state) => {
                    if (window.webRTCWorkspaces.debug) {
                        console.log('Camera toggle for local. New state is ' + (state ? 'ON' : 'OFF'));
                    }
                    window.webRTCWorkspaces.setCamState(state);
                    if (state) {
                        $('#btn-call-cam-on').removeClass('hide');
                        $('#btn-call-cam-off').addClass('hide');
                    }
                    else {
                        $('#btn-call-cam-on').addClass('hide');
                        $('#btn-call-cam-off').removeClass('hide');
                    }
                };

                showJoinForm = () => {
                    $('#create-form').addClass('hide');
                    $('#join-form').removeClass('hide');
                };
                showCreateForm = () => {
                    $('#create-form').removeClass('hide');
                    $('#join-form').addClass('hide');
                };
            `
        );
    };

    //
    // Views
    //
    renderCanvas() {
        return (
            `
                <!-- LOADER -->
                <div id="spinner-back"></div>
                <div id="spinner-front"><div class="spinner-grow text-light" style="width: 5rem; height: 5rem;"><span class="sr-only">Loading...</span></div></div>

                <!-- TOASTS -->
                <div aria-live="polite" aria-atomic="true" class="position-relative" style="z-index:10000"><div class="toast-container position-absolute end-0 top-0 p-3"></div></div>

                <!-- ROUTE :: Welcome -->
                <div id='welcome' class='active-route'>
                    <br/><br/>
                    <div class='container'>
                        <div class='text-center'>
                            <h3>WebRTCWorkspaces</h3>
                        </div>
                        <br/>
                        <div class="row">
                            <div class="col" id='create-form'>
                                <div class="card">
                                    <div class="card-header">Create New Workspace</div>
                                    <div class="card-body">
                                        <form name='create-ws' method='post' action='#' onsubmit='return(false);'>
                                            <div class="form-group">
                                                <label for='create-ws-name'>Workspace Name <span class='text-danger'>*</span></label>
                                                <input class="form-control" type='text' name='create-ws-name' id='create-ws-name' minlength='2' manlength='50' required/>
                                            </div>
                                            <div class="form-group">
                                                <label for='create-attnd-name'>Your Name <span class='text-danger'>*</span></label>
                                                <input class="form-control" type='text' name='create-attnd-name' id='create-attnd-name' minlength='2' manlength='50' value='Untitled Attendee' required/>
                                            </div>
                                            <div class="form-group">
                                                <label for='create-ws-pin'>Workspace PIN</label>
                                                <input class="form-control" type='text' name='create-ws-pin' id='create-ws-pin'  minlength='0' manlength='5'/>
                                            </div>                                            
                                            <div class="form-group">
                                                <small class='text-danger'>* Required</small>
                                            </div>
                                            <div class="form-group text-center">
                                                <button type="button" onclick='createWorkspace()' class='btn btn-outline-secondary'>Create Workspace</button>
                                                <br/><br/>
                                                <button type="button" class="btn btn-link" onclick="showJoinForm()">Have an access token? Click here to join a workspase...</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                            <div class="col hide" id='join-form'>
                                <div class="card">
                                    <div class="card-header">Join a Workspace</div>
                                    <div class="card-body">
                                        <form name='join-ws' method='post' action='#' onsubmit='return(false);'>
                                            <div class="form-group">
                                                <label for='join-ws-token'>Workspace Token <span class='text-danger'>*</span></label>
                                                <input class="form-control" type='text' name='join-ws-token' id='join-ws-token' minlength='10' manlength='150' required/>
                                            </div>
                                            <div class="form-group">
                                                <label for='join-attnd-name'>Your Name <span class='text-danger'>*</span></label>
                                                <input class="form-control" type='text' name='join-attnd-name' id='join-attnd-name' minlength='2' manlength='50' value='Untitled Attendee' required/>
                                            </div>
                                            <div class="form-group">
                                                <label for='join-ws-pin'>Workspace PIN</label>
                                                <input class="form-control" type='text' name='join-ws-pin' id='join-ws-pin'  minlength='0' manlength='5'/>
                                            </div>
                                            <div class="form-group">
                                                <small class='text-danger'>* Required</small>
                                            </div>
                                            <div class="form-group text-center">
                                                <button type="button" onclick='joinWorkspace()' class='btn btn-outline-secondary'>Join Workspace</button>
                                                <br/><br/>
                                                <button type="button" class="btn btn-link" onclick="showCreateForm()">Click here to create a new workspase...</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="container-fluid text-center" style="position:fixed; background-color: rgba(0, 0, 0, 0.05); bottom:0;">
                        Crafted with <span class='text-danger'>&#10084;</span> &nbsp; by DpG
                    </div>
                </div>
                
                <!-- ROUTE :: Workspace -->
                <div id='workspace' class='hide'>
                    <div id='webRTCWorkspacesVideoFrames' class='video-canvas'></div>
                    <div class='call-buttons'>
                        <center>
                            <div class='row'>
                                <div id='btn-call-share' class="col"><i onclick='shareCall();' class="fas fa-share-alt text-white lg-icon"></i></div>
                            
                                <div id='btn-call-mic-on' class='col'><i onclick='toggleMic(false);' class='fas fa-microphone text-white lg-icon'></i></div>
                                <div id='btn-call-mic-off' class='col hide'><i onclick='toggleMic(true);' class='fas fa-microphone-slash text-danger lg-icon'></i></div>

                                <div id='btn-call-cam-on' class='col'><i onclick='toggleCam(false);' class='fas fa-video text-white lg-icon'></i></div>
                                <div id='btn-call-cam-off' class='col hide'><i onclick='toggleCam(true);' class='fas fa-video-slash text-danger lg-icon'></i></div>

                                <div id='btn-call-exit' class="col"><i onclick='destroyWorkspace();' class="fas fa-sign-out-alt text-danger lg-icon"></i></div>                                
                            </div>
                        </center>
                        <input type='text' id='wsToken' style='position: absolute; top: -1000px; left: -1000px'/>
                    </div>
                </div>
            `
        );
    };
    renderVideoFrame(args) {
        return (
            `
                <video
                    id='${args.attendee.id}-video-frame:video-object'
                    ${args.muteState ? 'muted' : ''}
                    class='video-frame-video'
                    autoPlay
                    playsInline
                ></video>
                <p class='video-frame-name'>${args.attendee.name} ${window.webRTCWorkspaces.isLocal(args.attendee.id) ? "(you)" : "<span id='video-frame-ringing-"+args.attendee.id+"' class='ringing-bell'><i class='fa fa-bell faa-ring animated'></i></span>"}</p>
                <div
                    id='${args.attendee.id}-video-frame:video-canvas'
                    class='video-frame-canvas'
                ></div>            
            `
        );
    };
    renderAlert(message) {
        return(
            `
            <div class="toast align-items-center" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class='fa fa-bell faa-ring animated text-muted'></i>&nbsp;${message}
                    </div>
                    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
            `
        );
    };


    //
    // Basic/Default functionalities
    //
    doAlert(message)  {
        const toastDiv = document.createElement('span');
        toastDiv.innerHTML = this.renderAlert(message);
            if (window.webRTCWorkspaces.debug) {
                console.log('Add toast notification...');
                console.log(message);
                console.log(toastDiv);
                console.log('--');
            }
            toastDiv.id = 'tD_' + new Date().getTime();         
        document.querySelector('.toast-container').appendChild(toastDiv);

        const toastEl = document.querySelector('#' + toastDiv.id + ' div.toast');
        const toast = new bootstrap.Toast(toastEl, {
            "animation": true,
            "autohide": false,
        });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', function () {
            toastDiv.remove();
        });
    };
    doLoading() {
        document.getElementById("spinner-back").classList.add("show");
        document.getElementById("spinner-front").classList.add("show");
    };
    doLoaded() {
        document.getElementById("spinner-back").classList.remove("show");
        document.getElementById("spinner-front").classList.remove("show");
    }
};

//
// Utility function to change the widths and heights of the video elements
//--> Rearange after the new insertion of the video frame
function redrawVideoFrames() {
    //
    // Maximum number of video frames permited is 4
    //
    const videoElems = document.querySelectorAll('.video-frame');

    if (window.webRTCWorkspaces.debug) {
        console.log('Video Frame Canvas Redraw...');
        console.log(videoElems);
        console.log('--');
    }

    videoElems.forEach((vElem) => {
        vElem.className = "video-frame video-frame-" + videoElems.length;
    });
}