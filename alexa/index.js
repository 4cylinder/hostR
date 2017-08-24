'use strict';
var Alexa = require('alexa-sdk');
var AWS = require('aws-sdk');
var request = require('request');

AWS.config.update({
	region: "us-east-1",
	accessKeyId: "",
	secretAccessKey: ""
});

var docClient = new AWS.DynamoDB.DocumentClient();

var skillName = "hostR";
var doneWith = "none";

exports.handler = function (event, context) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = "";
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var userId = "";

var handlers = {
	
	"LaunchRequest": function(){
		// get user ID
        var accessToken = this.event.session.user.accessToken;
        var amznProfileURL = 'https://api.amazon.com/user/profile?access_token=' + accessToken;
        var alexa = this;
        request(amznProfileURL, function(error, response, body) {
        	if (response.statusCode == 200) {
	            var profile = JSON.parse(body);
	            userId = profile.user_id;
	            alexa.attributes["quitting"] = null;
				alexa.attributes["askingQuestions"] = false;
				alexa.attributes["category"] = null;
				alexa.attributes["inAreaQuestions"] = null;
				alexa.attributes["dataItems"] = null;
				alexa.attributes["dataItemsLength"] = null;
				alexa.attributes["dataItemCurrent"] = null;
		      
		        var speechText = "Hoster here, how can I be of assistance?";
		        var repromptText = "You can ask me questions about household items, or for recommendations in the area.";
		        alexa.emit(":ask", speechText, repromptText);
	        } else {
	        	alexa.emit(":tell", "I'm sorry, I can't connect to Amazon Profile Services right now. Please try again");
	        }
        });
	},
	
	// This intent is called when the user asks a question
	
	"questionIntent": function(){
		var alexa = this;
        var speechText = "";
        //TODO: Make this the correct name
		var subjectSlot = this.event.request.intent.slots.QUESTION_ITEM.value;

        console.log("attempt to find " + subjectSlot);
        console.log("userId is "+userId);

        var accessToken = this.event.session.user.accessToken;
        var amznProfileURL = 'https://api.amazon.com/user/profile?access_token=' + accessToken;
        request(amznProfileURL, function(error, response, body) {
        	if (response.statusCode == 200) {
	            var profile = JSON.parse(body);
	            userId = profile.user_id;
	            
	            var params = {
		            TableName : "houseQuestions",
		            FilterExpression: "#subject = :subject AND #userId = :userId",
		            ExpressionAttributeNames: {
		                "#subject": "subject",
		                "#userId": "userId"
		            },
		            ExpressionAttributeValues: {
		                ":subject": subjectSlot,
		                ":userId": userId
		            }
		        };
		        console.log("params created: " + params);

		        docClient.scan(params, function(err, data) {
		            console.log("scanning!");
		            if (err) {
		                console.log("Unable to query. Error:", JSON.stringify(err, null, 2));
		                alexa.emit(":tell", "I'm sorry, I'm having trouble looking up your items. Please try again later.");
		            } else {
		                console.log("Query succeeded.");
		                console.log("there are " + data.Items.length + " items returned.");
		                if (data.Items.length == 0) {
		                    console.log("Could not find " + subjectSlot);
		                    alexa.emit(":ask", "I'm sorry, I found no answers about " + subjectSlot + ". Please try asking a different question.");
		                } else {
		                	data.Items.sort(function(a, b) {
							    return parseInt(b.qId) - parseInt(a.qId);
							});
							alexa.attributes["dataItems"] = data.Items;
							alexa.attributes["dataItemsLength"] = data.Items.length;
		                    // First, just choose the first answer from the list of matches
		                    var response  = data.Items[0];
		                    console.log(response.subject);
							console.log(response.answer);
							
							//TODO: Make these for our new table
		                    alexa.attributes["answer"] = response.answer;
							var answer = response.answer;
							alexa.attributes["category"] = response.category;
							var category = response.category;
							var distance = response.distance;
							var type = response.attr;
							
							if(category == "House"){
			                    var speechText = "The answer to your question is " + answer + ". Is there anything else I can help you with?";
			                    alexa.attributes["askingQuestions"] = true;
								alexa.emit(":ask", speechText);
							} else{
								alexa.attributes["askingQuestions"] = false;
								alexa.attributes["inAreaQuestions"] = true;
								alexa.attributes["dataItemCurrent"] = 0;
								
								var speechText = "One place for " + category + " is " + answer + ". It is " + distance + " miles away";
						
								if ((category == "Breakfast") || (category == "Lunch") || (category == "Dinner")){
									speechText += " and has " + type + " cuisine";
								}
						
								speechText += ". Is this where you want to go?";

								alexa.attributes["dataItemCurrent"] = alexa.attributes["dataItemCurrent"] + 1;
								alexa.emit(":ask", speechText);
							}
		                    
		                }
		            }
		        });
	        } else {
	        	alexa.emit(":tell", "I'm sorry, I wasn't able to connect to Amazon Profile Services. Please verify that you linked your account in this skill via the Alexa mobile app.");
	        }
        });
        
	},
	
	// This intent is called when the user needs help
	"AMAZON.HelpIntent": function(){
		//TODO: Customize based on where we are in the program
		var speechText = "You can ask me questions about household items, or for recommendations in the area.";
		speechText += " For example, try asking me, where are the extra pillows? Or, where can I go for dinner?";
		this.emit(":ask", speechText);
	},
	
	// This intent is called when the user asks to quit/exit
	
	"quitIntent": function(){
		
        this.attributes["quitting"] = true;
        
        var speechText = "Are you sure you want to quit hoster?";
        this.emit(":ask", speechText);
		
	},
	
	// This intent is called when the user says "yes"
	
	"AMAZON.YesIntent": function(){
       // Enter this state if user has asked to quit
        if (this.attributes["quitting"]) {

            // If we are in this case, we have requested to exit the application.
            this.attributes["quitting"] = false;
            this.emit(":tell", "Okay, enjoy your stay. Goodbye!");
  
        }
		else if (this.attributes["askingQuestions"]){
			this.attributes["askingQuestions"] = false;
			this.emit(":ask", "Okay, what else can I help you with?");
		}
        else if (this.attributes["inAreaQuestions"]){
            var speechText = "Great! Is there anything else I can help you with?";
			this.attributes["inAreaQuestions"] = false;
			this.attributes["askingQuestions"] = true;
            this.emit(":ask", speechText);
        }
		else{
			// Handle case where this intent is called when not quitting
        	var speechText = "I'm sorry, I didn't understand your request. What can I help you with?";
			this.emit(":ask", speechText);
        }
	},
	
	// This intent is called if the user says "no"
	
	"AMAZON.NoIntent": function() {
        if (this.attributes["quitting"]) {
            //user does not want to quit
            var speechText = "Ok, what can I help you with then?";
            this.attributes["quitting"] = false;
            this.emit(":ask", speechText);
        }
		else if (this.attributes["askingQuestions"]){
			this.attributes["askingQuestions"] = false;
			this.emit(":tell", "Okay, enjoy your stay. Goodbye!");
		}
        else if (this.attributes["inAreaQuestions"]){
			if (this.attributes["dataItemCurrent"] == this.attributes["dataItemsLength"]){
				var speechText = "Sorry, that's all the recommendations I have. Is there anything else I can help you with?";
				this.attributes["inAreaQuestions"] = false;
				this.attributes["askingQuestions"] = true;
				this.emit(":ask", speechText);
			} else{
				var category = this.attributes["category"];
				var answer = this.attributes["dataItems"][this.attributes["dataItemCurrent"]].answer;
				var distance = this.attributes["dataItems"][this.attributes["dataItemCurrent"]].distance;
				var type = this.attributes["dataItems"][this.attributes["dataItemCurrent"]].attr;
				
				var speechText = "Another place for " + category + " is " + answer + ". It is " + distance + " miles away";
				
				if ((category == "Breakfast") || (category == "Lunch") || (category == "Dinner")){
					speechText += " and has " + type + " cuisine";
				}
				
				speechText += ". Is this where you want to go?";
				
				this.attributes["dataItemCurrent"] = this.attributes["dataItemCurrent"] + 1;
				this.emit(":ask", speechText);
		
			}
			
			
        } else{
        	var speechText = "I'm sorry, I didn't understand your request. What can I help you with?";
			this.emit(":ask", speechText);
        }
        
	}
	
};