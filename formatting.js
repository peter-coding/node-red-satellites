module.exports = function (RED) {
	"use strict";
	var express = require("express");
	var path = require("path");
	var io = require('socket.io');

	var satellite = require('satellite.js').satellite;
	var socket;

	var Bounds = {
		'oo':function(lower, value, upper){return ((lower<value)&&(value<upper))},
		'oc':function(lower, value, upper){return ((lower<value)&&(value<=upper))},
		'co':function(lower, value, upper){return ((lower<=value)&&(value<upper))},
		'cc':function(lower, value, upper){return ((lower<=value)&&(value<=upper))}
	};

	function WMTrajectory(input){
		
		var starfleet = input.payload;
		var outputArray = [];
		
		//General Formatting
		for (var i=0; i<starfleet.length; i++){
			
			//Satellites
			var starship = starfleet[i];
			//color paintJob variable from satellites node.

			//Timestamps per Satellite
			var latlongpos = starship.latlongpos;
			
			var timeArrayNumParse = input.error[0].timeerror;
			var samples;
			
			if (timeArrayNumParse==="single" || timeArrayNumParse==="none"){
				samples = 0;//not in array format.
			}
			else if (timeArrayNumParse==="plural"){
				samples = latlongpos.length;
			};
			
			//Remove the height entry from the latitudes and longitudes
			var latlongpoints=[];
			for (var j=0;j<samples;j++){
				latlongpoints[j] = [latlongpos[j][0],latlongpos[j][1]];
			};
			
			//Splitting up and formatting the trajectory Line.
			if ((samples>0)&&latlongpos){
				
				var deltalong=[], discontLog=[0];
				
				//Set up the array of longitudes
				for(var j=0;j<samples;j++){
					deltalong[j]=180+latlongpos[j][1];//distance from far left of map
				};
				
				//Determine if two consecutive longitudes straddle the 360---0 discontinuity
				for(var j=0;j<samples;j++){

					var ulbound = Math.ceil((360/samples));
					var lubound = Math.floor(360*((samples-1)/samples));
					
					if((Bounds['cc'](0,Math.floor(deltalong[j]),ulbound)&&Bounds['cc'](lubound,Math.floor(deltalong[j+1]),360)) 
						|| (Bounds['cc'](lubound,Math.floor(deltalong[j]),360)&&Bounds['cc'](0,Math.floor(deltalong[j+1]),ulbound))){
						discontLog.push(j+1);//this may mean that no line would be drawn if there are only two samples taken.
					};

				};

				//Format the line property
				var placeholder=latlongpos;//All points along the line
				discontLog.push(placeholder.length);//The final point of the line;

				var line=[];
				var outputIndex = outputArray.length;//find out how many lines the previous satellite took up.
				for(var j=0;j<discontLog.length-1;j++){

					var section = RED.util.cloneMessage(input);//New message for each piecewise element of the line.
					line = placeholder.slice(discontLog[j],discontLog[j+1]);
					//^^^still need to include the small bit of line leading up to/away from discontinuity (only major issue for low res. lines)^^^
					
					section.payload = {name:starship.name+'_line'+j,
									   layer:starship.name,
									   //colour property
									   line: line};

					outputArray[outputIndex+j] = section;
				};//for each line segment
			
			};//if there are multiple timestamps with which to draw a trajectory.
			
		};//for each satellite.
		return [outputArray];
	};

	function Markers(input,nodeType,excess){
		var starfleet = input.payload;
		var outputArray = [];

		/*-- General Formatting--*/
		for (var i=0; i<starfleet.length; i++){
			
			//Satellites
			var starship = starfleet[i];
			//color paintJob variable from satellites node.

			//Excess
			var rogue1 = RED.util.cloneMessage(input);
			
			if(excess){
				rogue1.payload = {name:starship.name};
			}
			else{
				rogue1.payload = starship;
			};

			//Earth
			if(nodeType==="FormatEarth"){

				rogue1.payload.position={
					x:starship.currentposition[0],
					y:starship.currentposition[1],
					z:starship.currentposition[2]
				};
				
			}
			
			//Worldmap
			else if(nodeType==="FormatWorldmap"){//Worldmap

				rogue1.payload.lat = starship.currentposition[0];
				rogue1.payload.lon = starship.currentposition[1];
				rogue1.payload.layer = 	starship.name;		
			
			};

			/*--Template for the future adaptations--
			else if(nodeType===""){

			}*/	

			outputArray[i] = rogue1;
		}

		return [outputArray];
	}

	/*--format node for Earth node--*/
	function FormatEarth(config) {
		RED.nodes.createNode(this, config);
		this.name = config.name || '';
		this.clear = config.clear || '';
		var node = this;

		this.on('input', function (msg) {

			var formatted = Markers(msg,"FormatEarth", node.clear);
			node.send(formatted);
		});
	}
	RED.nodes.registerType("FormatEarth", FormatEarth);

	/*--format node for Worldmap node--*/
	function FormatWorldmap(config) {
		RED.nodes.createNode(this, config);
		this.name = config.name || '';
		this.clear = config.clear || '';
		var node = this;

		node.on('input', function (msg) {
			
			var pins = Markers(msg,"FormatWorldmap", node.clear);
			var lines = WMTrajectory(msg);
			//var total = pins.concat(lines);
			node.send(pins);
			node.send(lines);
		});

	}
	RED.nodes.registerType("FormatWorldmap", FormatWorldmap);

	/*--Template Format node--
	function Template(config) {
		RED.nodes.createNode(this, config);
		this.name = config.name || '';
		this.clear = config.clear || '';
		var node = this;

		node.on('input', function (msg) {
			
			var formatted = Markers(msg,"FormatWorldmap", node.clear);
			node.send(formatted);
		});

	}
	RED.nodes.registerType("Template", Template);*/
};



			