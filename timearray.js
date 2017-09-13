module.exports = function (RED){
	"use strict";
	var express = require("express");
	var path = require("path");
	var io = require('socket.io');
	var socket;

	function TimeArrayNode(config) {
		RED.nodes.createNode(this, config);

		this.minus = (config.minus < 0) ? 0 : config.minus;
		this.minus = this.minus * 60 * 1000; // convert values from minutes to milliseconds

		this.plus = (config.plus < 0) ? 0 : config.plus;
		this.plus = this.plus * 60 * 1000; // convert values from minutes to milliseconds

		this.samples = (config.samples < 1) ? 1 : config.samples;
		this.currentInclude = config.currentInclude || '';
		var node = this;
		
		node.on('input', function (msg) {
			var arraytimes = [];
			var timenow=msg.payload;
			if (node.samples < 1) {
				node.samples = 1;
			}
			var t = parseInt(timenow),
				t0 = t - node.minus,
				t1 = t + node.plus;
			
			/*--Two intervals--*/
			if(node.currentInclude === true){
				var	LowSamples = Math.floor((node.samples)*((t-t0)/(t1-t0))),
					HighSamples= node.samples - LowSamples,
					delta1 = (t - t0)/((LowSamples)-1),
					delta2 = (t1 - t) / ((HighSamples));//need extra gap between 
				/*
				delta measures gaps between end points 
				e.g. +-+-+-+-+-+-+, where + are (t0+(i*delta)), separated by -, delta.
				to ensure that the current time and the two end points are included in the array of times,
				the samples are spread across two intervals, t0-->t and t-->t1.
				*/
				for (var i = 0; i < LowSamples; i++) {//Starts at t0 and ends at t.
					var time = t0 + (i * delta1);
					arraytimes.push(parseInt(time));
				}
				for (var i = 1; i < HighSamples+1; i++) {//Starts at 1 because t was put in the array by previous loop.
					var time = t + (i * delta2);
					arraytimes.push(parseInt(time));
				}
			}

			/*--One Interval--*/
			else if (node.currentInclude === ""){
				var delta=(t1-t0)/((node.samples)-1);
					
				/*				
				delta measures gaps between end points 
				e.g. +-+-+-+-+-+-+, where + are (t0+(i*delta)), separated by -, delta.
				line 30 is as is becaseue there is one less delta (-) than points (+), 
				But then line 41 is as is becasue we're iterating over the points, rather than the gaps.
				*/

				for(var i=0;i<node.samples;i++){
					var time=t0+(i*delta);
					arraytimes.push(parseInt(time));
				}
			};
			msg.payload = {
				currenttime: timenow,
				times: arraytimes
			};
			node.send(msg);
		});

	}
	RED.nodes.registerType("timearray", TimeArrayNode);
}

/*--Code 1.1--
			
*/