// to do:
//    fix autoload-last-book with fileSystem
//    metadata
//    seek with arrow keys
//    scrollbar for long libraries
//    put books on google drive for listening?
//    test on multiple devices
//    podcast support?
//    unload book when library is removed or book deleted
//    stop keyEvents from "bubbling"

//  Utilities  //////////////////////////

function extend (A,B) {
   A.splice.apply(A, [A.length,0].concat(B))}

function create (tag, attributes) {
   var thing = document.createElement(tag)
   for (var x in attributes) {
      thing[x] = attributes[x]}
   return thing}
   
function update (O, P) {
   for (k in P) {O[k] = P[k]}}

function makeButton (id, text, onclick,listing) {
   var b = create("button", {
   id: id, innerHTML : text, onclick : onclick})
   return b}

function now () {
   return Date.now()/1000}

function apply () {
   // apply( f, arg1, arg2, ..., arg_n, Array )
   var f = arguments[0]
   var A = arguments.pop()
   return f.apply(window, arguments.slice(1).concat(A))}
   
function updateStorage (Storage) {
   playbackInfo.currentTime = player.currentTime
   var item = {}; item[Book.Id] = playbackInfo;
   Storage.set(item); }

function setHTML(id,HTML) {
   document.getElementById(id).innerHTML=HTML}
   
function stringifyTime(t) {
   s = Math.floor(t)%60; m = Math.floor(t/60)%60;
   h = Math.floor(t/3600);
   return [h,m,s].map(function(x){return x.toString()}).join(":")}
   
function Dict(){ // takes k, v, k, v, ..., k, v
   if (!(arguments.length % 2 ===0)) throw "Argument Error: \
      Dict constructor takes an even number of arguments."
   for (var i=0;i<arguments.length;i+=2 ) {
      this[arguments[i]]=arguments[i+1]}}
   
   
//  Globals  ///////////////////////////

var interval, interval60
var Book ={}; var playbackInfo = {}
var player = document.getElementById('player');
var Storage = chrome.storage.sync
var Local = chrome.storage.local
var Sync = chrome.storage.sync
var metadataLoadStack = []
var volumeInput=document.getElementById("volumeInput")
               
//  The Player  ////////////////////////
   
function load(n, noUpdate) {
   var playing = !player.paused
   var speed = player.playbackRate
   
   metadataLoadStack.push( function(){
      setHTML("durationSpan", stringifyTime(player.duration))})
   player.src = Book.files[n]
   setHTML("songTitle", Book.names[n])
   setHTML("currentTimeSpan", "0:00:00")
   
   player.volume = getVolume()
   playbackInfo.currentFile = n
   setSpeed(speed, noUpdate) //setSpeed always does updateStorage(Storage)
   if (playing) player.play()} //player.play}
//load(0)

function play() {
   var offset = Math.max( 
             -30, -Math.sqrt(now() - playbackInfo.pausedAt));
   seek(offset, false, true)
   player.play()}

function pause() {player.pause()}

function prev(force, time) {
   if (force===true) {
      var file = playbackInfo.currentFile
      if (file == 0) {
         seek(0,true)}
      else {
         if (time) {
            metadataLoadStack.push( function(){
               seek(player.duration + time)})}
         load(file-1)}}
   else if (player.currentTime < 5) {
      prev(true, time) }
   else {
      seek(0, true) 
   }}
      
function next(time) {
   var file = playbackInfo.currentFile
   if (file == Book.lastFile) {
      seek(player.duration, true) }
   else {
      load(file + 1)
      if (typeof(time)=="number") {
         seek(time) }}}
         
function seek(offset, absolute, noUpdate) {
   var newTime = (absolute)? offset : player.currentTime+offset
   if (newTime < 0) {
      prev(true, newTime) }
   else if (newTime > player.duration) {
      next(newTime - player.duration) }
   else {
      player.currentTime = newTime }
   if (!noUpdate) updateStorage(Storage)
   setHTML("currentTimeSpan", stringifyTime(player.currentTime))}
      
      
function setSpeed(x, noUpdate) {
   player.playbackRate = x
   playbackInfo.playbackRate = x
   if (!noUpdate) updateStorage (Storage)}

function updateLog() {
   var ct =player.currentTime
   playbackInfo.currentTime = ct 
   playbackInfo.playingAt = now()
   setHTML("currentTimeSpan", stringifyTime(ct))}

player.onended = function() {
   if (playbackInfo.currentFile < Book.lastFile) {
      next(); player.play() } }   

player.onpause = function() {
   clearInterval(interval);clearInterval(interval60);
   playbackInfo.currentTime = player.currentTime
   if (playbackInfo.playingAt - now() > 1) console.log(
      "onpause fired when player was not playing!")
   playbackInfo.pausedAt = now()
   updateStorage(Storage)
   document.getElementById("playpause").innerHTML="Play"}

player.onplaying = function() {
   playbackInfo.playingAt = now()
   updateStorage(Storage)
   interval = setInterval(updateLog, 1000)
   interval60 = setInterval(
      function(){updateStorage(Storage)},60000)
   document.getElementById("playpause").innerHTML="Pause"}
   
player.onloadedmetadata = function(){
   while (metadataLoadStack.length){
      f = metadataLoadStack.pop(); f() }}
      
volumeInput.onchange=function(){player.volume=getVolume()}
function getVolume(){
   if (volumeInput.value===""){var x = 1}
   else { var x = Number(volumeInput.value)/100}
   return x}
      
document.body.onkeydown = function(event){
   switch (event.keyCode) {
      case 32: playpause.onclick();return;break;
      case 38: 
         volumeInput.value = Math.min(100,volumeInput.value+10)
         break;
      case 40: 
         volumeInput.value = Math.max(0,volumeInput.value-10)
         break;}
   volumeInput.onchange()
   }
   
         
//  mediaGalleries  /////////////////////////////

function getGalleryId (gallery) {
   if (gallery.id) return gallery.id
   return chrome.mediaGalleries.getMediaFileSystemMetadata(
      gallery).galleryId}
   
var glist = []

function make_glist() {
   function removalButton (gallery,line) {
      var b= makeButton(
         "rb_"+gallery.id, "Remove", function () {
            glistdiv.removeChild(line)
            glist.splice(glist.indexOf(gallery),1)
            Local.remove(gallery.id)
            
            removeGallery(gallery)})
      return b}
   
   function renamerButton(gallery) {
      var span = create("span")
      var box = create("input", {hidden:"true"});
      
      function onclick () {
         //var parent = this.parentElement
         //var box = parent.getElementsByTagName("input")[0]
         var rb = document.getElementById("rb_"+gallery.id)
         if (box.hidden) {
            box.hidden=false
            rb.hidden = true}
         else {
            rb.hidden = false
            box.hidden = true
            if (box.value) {setName(gallery.id, box.value)
               storeName(gallery, box.value)
               box.value = ""}}}
      span.appendChild(box)
      span.appendChild(makeButton("","Rename", onclick))
      return span }
      
   function storeName(gallery, name){
      Local.set( new Dict(gallery.id,name))}
   
   function setName(IdOrSpan, name) {
      if (typeof(IdOrSpan)=="string") {
         var span = document.getElementById(
            "displayName_"+IdOrSpan)}
      else{ var span = IdOrSpan}
      span.innerHTML=name }
   
   function getAndSetName(gallery, span){
      var kd = new Dict(gallery.id,gallery.dname)
      Local.get(kd, function(o){
         var name = o[gallery.id];
         setName(span, name); storeName(gallery, name)})}
   
   function addLine(gallery) {
      var line = create("li") 
      //line.id="glistdiv_" + gallery.id
      //line.class="listingDiv"
      
      var span = create("span", {id: "displayName_"+gallery.id})
      getAndSetName(gallery, span)
      
      line.appendChild(renamerButton(gallery))
      line.appendChild(removalButton(gallery,line))
      line.appendChild(span)
      
      
      glistdiv.appendChild(line)
      glist[glist.length] = gallery}
   
   function addFS(FS){
      FS.id = getGalleryId(FS)
      FS.dname = (FS.dname)?FS.dname:"Gallery "+FS.id
      addLine(FS)}
   
   function populateFromFSArray(A){
      A.forEach(addFS) }
   
   var addGallery, removeGallery, FileSystem
   
   if (useFileSystem) {
      function FileSystem(D, id){
         this.isSpoof = true
         this.root = D
         this.id = id
         this.dname = "Gallery "+D.name      
      }//console.log("FS(D).id: ",this.id)}
         
      addGallery = function() {
         chrome.fileSystem.chooseEntry({type:"openDirectory"},
            function (d){
               var id = chrome.fileSystem.retainEntry(d)
               addFS(new FileSystem(d, id))
               Local.get({Directories:[]},
                  function(o){ 
                     var D = o.Directories
                     D.push(id)
                     Local.set({Directories: D})})})}  
            
      removeGallery = function(gallery){
         Local.get("Directories",
            function(o){
               var D = o.Directories
               D.splice(D.indexOf(gallery.id),1)
               Local.set({Directories: D})})}         
      
      var kd = new Dict("Directories",[])
      Local.get(kd, function(o){ 
         o.Directories.forEach(function(id,i){
            chrome.fileSystem.restoreEntry(id, function(entry){
               addFS(new FileSystem(entry, id))})})}) }
            
   else{
      addGallery = function() { 
         chrome.mediaGalleries.addUserSelectedFolder(
            function (A,s) { addFS( A.pop() ) }) }
            
      removeGallery = function(gallery){
         chrome.mediaGalleries.dropPermissionForMediaFileSystem(
               gallery.id)}
   
      chrome.mediaGalleries.getMediaFileSystems(
         populateFromFSArray)}
   
   newGallery.onclick=addGallery   }

var useFileSystem = true
make_glist()
         
function showGalleries () {
   if (Galleries.hidden){
      Galleries.hidden = false
      manageButton.innerHTML = "Hide Folders"}
   else{
      Galleries.hidden= true
      manageButton.innerHTML = "Manage Audiobook Folders"}}
   
   
//  Library  ////////////////////////////////

   // todo:
   //  warn users if playing the same book in two devices

if (useFileSystem){  getURL = function(entry, blob){
                        return URL.createObjectURL(blob)}}
else {               getURL = function(entry, blob){
                        return entry.toURL()}}
   
function readAndDo(reader,f) {
   var acc = []
   function Callback (entries) {
      if (entries.length) {
         extend(acc,entries)
         reader.readEntries(Callback)}
      else { f(acc) }}
   reader.readEntries(Callback)}
   
function loadBook(bookId,urls, names) { //all params should be strings or string-arrays
   pause()  // make sure this is safe when nothing is loaded!
   document.getElementById("bookTitle").innerHTML = bookId
   update(Book, {files: urls, lastFile:urls.length-1,
      Id:bookId, names:names})
   Local.set({lastPlayed: Book})
   
   var keyDefault = {}; keyDefault[bookId] = {
      currentFile:0, currentTime:0, playbackRate: 1, 
      playingAt:now(),pausedAt:now()};
   function loadBook (object) {
      update(playbackInfo, object[bookId])
      load(playbackInfo.currentFile, true)
      seek(playbackInfo.currentTime,true, true)
      setSpeed(playbackInfo.playbackRate, true)}
   
   Storage.get(keyDefault, loadBook)}

function addBook(dir, fileList, books) { //maybe don't need "books" param
   var urls = fileList.map(function (x) {return x[2]})
   var names = fileList.map(function (x) {return x[1]})
   var line = create("li")
   line.appendChild(makeButton("","Listen",
      function () {loadBook(dir.name,urls, names)}))
   line.innerHTML+=dir.name
   //books.push(fileList); 
   Library.appendChild(line)}
        
function showLibrary () {
   if (Library.hidden){
      refreshLibrary()
      Library.hidden = false
      libraryButton.innerHTML = "Hide Library"}
   else{
      Library.hidden=true
      libraryButton.innerHTML = "Library"}}
   
function findBooks(root, books) {
   function recurse (acc) {
      var isBook = false
      var fileList = []
      for (var i = 0; i < acc.length; i++) {
         var entry = acc[i]
         if (entry.isDirectory) {findBooks(entry,books)}
         else {
            function f(entry) {
               entry.file( function (blob) {
                  if (blob.type.slice(0,5)=="audio") {
                     isBook = true
                     fileList.push( 
                        [entry,entry.name, getURL(entry,blob)])}
                  
                  // try to find a way to get metadata from the Audio element
                  // chrome.mediaGalleries.getMetadata(
                     // blob, {metadataType: "mimeTypeOnly"},
                     // function (metadata) {
                        // if (metadata.mimeType.slice(0,5)=="audio") {
                           // isBook = true
                           // fileList.push(
                              // [entry,entry.toURL(),entry.name])}})})}
                  })}
            f(entry)}}
      setTimeout(function(){
         if (isBook) addBook(root,fileList, books)},100)}
   
   readAndDo(root.createReader(),recurse)}
         
var books = []
function refreshLibrary() {
   Library.innerHTML = ""
   glist.forEach(
      function (gallery) {findBooks(gallery.root, books)});}

//load book on program start
function loadLast () {
   var keyDefault = {lastPlayed: {}}
   Local.get(keyDefault,
      function (obj) { var book = obj.lastPlayed;
         if (book.Id)loadBook(book.Id, book.files, book.names)})}

loadLast()
   
//  Buttons  //////////////////////////////////

var clickHandlers = {
   // button.onclick is called with click event as parameter;
   // I want most of these functions called without parameters.
   playpause: function(){if (player.paused){play()}else{pause()}},
   next: function(){next()},
   prev: function(){prev()},
   rw30: function() {seek(-30)},
   ff30: function() {seek(30)},
   rw5: function() {seek(-5)},
   ff5: function() {seek(5)},
   //setSpeed10: function() {setSpeed(10)},
   //setSpeed1: function() {setSpeed(1)}, 
   libraryButton: showLibrary,
   manageButton: showGalleries}
   

var buttons = document.getElementsByTagName("button")   
for (var i = 0; i < buttons.length; i++) { 
   if (buttons[i].id in clickHandlers){
   buttons[i].onclick = clickHandlers[buttons[i].id] }}
   
//chrome.mediaGalleries.getMediaFileSystems( function (A) {FS = A[0]})}
//chrome.mediaGalleries.addUserSelectedFolder
//
//
 