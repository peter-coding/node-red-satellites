module.exports = function (RED) {
	"use strict";
	var express = require("express");
	var path = require("path");
	var io = require('socket.io');

	var satellite = require('satellite.js').satellite;
	var socket;

	/*--Node Existance established--*/
	function SatelliteNode(config) {
		/*--inputs from HTML edit pane--*/
		RED.nodes.createNode(this,config);
		this.typeOption = config.typeOption || '';
		this.textInput = config.textInput || '';
		this.coordsys = config.coordsys || '';
		//this.color = config.color || '';	
		var node = this;

		/*--FUNCTION colorPicker: to choose, WITHOUT replacement, a random colour for each Satellite, using the global context to store 'taken' colours,
								   Takes global context, and maybe a seed value, as input and outputs an alphanumerical-# hex value--*/

		//To be written

		/*--FUNCTION obj2array: to convert data output from satellites.js functions which is an object, but should be an array.
								Takes in an object and an array of strings of each of the depedencies to loop through.--*/
		function obj2array(obj,property){
			var array=[];
			for (var i=0; i<property.length; i++){
				array[i] = obj[property[i]];
			}
			return array;
		}

		/*--FUNCTION array2obj: Complementing inverse function, incase needed to convert back to obj for lat/long convertion, because functions in satellites.js use objects.
								Takes 'property', an array of strings of each of the depedencies to assign array 'values' of vector to in the object.--*/
		function array2obj(vector, property){
			var obj = new Object();
			for (var i=0; i<property.length; i++){
				obj[property[i]] = vector[i];
			}
			return obj;
		}

		/*--FUNCTION parseSats: takes the a string of TLE data for multiple satellites, and separates the elements into individual satellites.--*/
		function parseSats(input) { 
			
			/*--Part 0: Configuration--*/
			var satText = input.split("");//convert continuous text into array of individual characters.
			var satEntries=[0];
			
			for (var i=0; i<satText.length; i++){
				var satTemp={};
				
				/*--Part 1: Finding the first line of the TLE--*/
				if (satText[i]==="1"&&satText[i+1]===" "&&satText[i+8]===" "&&satText[i+17]===" "&&satText[i+32]===" "
					&&satText[i+43]===" "&&satText[i+52]===" "&&satText[i+61]===" "&&satText[i+63]===" "){
					satTemp={'satid':satText.slice(satEntries.pop(),i).join(""),'tle1':satText.slice(i,i+69).join("")};
					satEntries.push(satTemp);
					i=i+69;
				}
				
				/*--Part 2: Finding the second line of the TLE--*/
				else if (satText[i]==="2"&&satText[i+1]===" "&&satText[i+7]===" "&&satText[i+16]===" "
					&&satText[i+25]===" "&&satText[i+33]===" "&&satText[i+42]===" "&&satText[i+51]===" "){
					satTemp=satEntries.pop();
					satTemp.tle2=satText.slice(i,i+69).join("");
					satEntries.push(satTemp,i+69);
					i=i+69;
				}
			}
			
			satEntries.pop();//remove the last index left by the last iteration through Part 2.
			return satEntries;
		}
		

		/*--Node Operation in Flow--*/
		this.on('input', function(msg) {
			
			/*--Initializing text and timestamp inputs--*/
			/*-Choose the source of data as either the textbox, or a dynamic input such as a file or HTTP request-*/
			var datasource;
			msg.error=[];
			if ((node.typeOption==="textOption")&&(typeof(node.textInput)==="string")){
				datasource=node.textInput;
			}
			else if ((node.typeOption==="dynamicOption")&&(typeof(msg.payload.textInput)==="string")){
				datasource=msg.payload.textInput;
			}
			else{
				datasource="";
				msg.error.push({texterror:"No valid TLE data"});
			};
			var starfleet = parseSats(datasource);
			var Xwingtemp = [];

			/*-Determine the type of timestamp input-*/
			var times = msg.payload.times;
			var currenttime = msg.payload.currenttime
			var datetime,timeconfig;
			var whattype = Object.prototype.toString;
			function format_single (input) {return (typeof(input) === 'number')};
			function format_many (input) {return (whattype.call(input) === '[object Array]')};
			
			/*Single timestamp input.*/
			if (format_single(msg.payload)){
				datetime=msg.payload;
				timeconfig="single";
			}
			
			/*Multiple timestamps stored in an array under property 'times', and current timestamp stored in property 'currenttime'.*/
			else if (format_many(times)){
				datetime = currenttime;
				timeconfig="plural";
			}
			
			/*Input other than timestamp*/
			else {
				var now = new Date();
				datetime = now.getTime();
				timeconfig="none";
			};
			msg.error.push({timeerror:timeconfig});
			
			/*--Perform calulations for each satellite in the starfleet--*/
			for (var j=0;j<starfleet.length;j++){
				
				/*-Part 0: Configuration-*/
				var starship = starfleet[j];//for each satellite separated out in starfleet
				var satTLEobj = {
									name: starship.satid,
									//iconColor: colorPicker(),
									tle1: starship.tle1, 
									tle2: starship.tle2,
									currenttime: datetime,
									times: times
								};

				var satrec = satellite.twoline2satrec(starship.tle1, starship.tle2);//convert tle data to satrec

				var euclidcoords = ['x','y','z'], latlongcoords = ['latitude','longitude', 'height'];

				/*-Part 1: Calculation of current position for different coordinate systems.-*/
				var currentPosvel = satellite.propagate(satrec, new Date(datetime));
				var currentPos = obj2array(currentPosvel.position, euclidcoords);
				var currentVel = obj2array(currentPosvel.velocity, euclidcoords);
				var currlatlongpos;
				if(node.coordsys === "latlongdeg"||node.coordsys === "latlongrad"){
					var gmst = satellite.gstimeFromDate(new Date(datetime));
					var templatlng = satellite.eciToGeodetic(currentPosvel.position, gmst);
					var currentlatlng = obj2array(templatlng, latlongcoords);
					if(node.coordsys === "latlongdeg"){
						var currlatitude = satellite.degreesLat(templatlng.latitude);
						var currlongitude = satellite.degreesLong(templatlng.longitude);
						currlatlongpos=[currlatitude,currlongitude,currentlatlng[2]];
					}
					else {
						currlatlongpos=currentlatlng;
					};
				}

				/*-Part 2: Calculating the different coordinate formats for the plurality of timestamps-*/
				if (timeconfig==="plural"){
					var pos=[],vel=[],arraylatlongpos=[];
					for (var i=0; i<times.length;i++){
						var posvel = satellite.propagate(satrec, new Date(times[i]));
						pos[i] = obj2array(posvel.position, euclidcoords);
						vel[i] = obj2array(posvel.velocity, euclidcoords);
						if(node.coordsys === "latlongdeg"||node.coordsys === "latlongrad"){
							var multigmst = satellite.gstimeFromDate(new Date(times[i]));
							var latlng = satellite.eciToGeodetic(posvel.position, multigmst);
							if(node.coordsys === "latlongdeg"){
								var latitude = satellite.degreesLat(latlng.latitude);
								var longitude = satellite.degreesLong(latlng.longitude);
								arraylatlongpos[i] = [latitude,longitude,latlng.height];
							}
							else if(node.coordsys === "latlongrad"){
								arraylatlongpos[i] = obj2array(latlng, latlongcoords);
							};
						};
					};
				};

				/*-Part 3: Formatting satellite objects for the different coordinate formats-*/
				/*Euclidean 3d coordinate system.*/
				if (node.coordsys === "euclid3d"){
					satTLEobj.currentposition=currentPos;
					satTLEobj.euclid3dpos = pos;
					satTLEobj.euclid3dvel = vel;
				}
				
				/*Latitude/Longitude/Height with angles given in degrees or radians*/
				else if (node.coordsys === "latlongdeg"||node.coordsys === "latlongrad"){
					satTLEobj.currentposition = currlatlongpos;
					satTLEobj.latlongpos = arraylatlongpos;
				};
				
				Xwingtemp.push(satTLEobj);	
			};
			
			msg.payload= Xwingtemp;
			node.send(msg);
		})
	};
	RED.nodes.registerType("satellite", SatelliteNode);
};