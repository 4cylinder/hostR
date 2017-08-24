import json
import pycurl
import urllib
import StringIO
import boto3
from boto3.dynamodb.conditions import Key, Attr
from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseRedirect
from django.shortcuts import render
from django.template import loader
from django.core.files.storage import FileSystemStorage

# set up DynamoDB credentials
dynamodb = boto3.resource('dynamodb', aws_access_key_id='',
    aws_secret_access_key='',
    region_name='us-east-1')

# Load login page if we're not logged in, otherwise go to main page
def index(request):
	# check for login status
	if request.session.has_key('hostName'):
		table = dynamodb.Table('houseQuestions')
		response = table.scan(
			FilterExpression=Attr('category').eq("House") & Attr('userId').eq(request.session['hostId'])
		)
		questions = response['Items']
		questions.sort(key=lambda q: int(q['qId']), reverse=True)

		return render(
			request,
			"index.html",
			context={
				'hostName': request.session['hostName'], 
				'hostEmail': request.session['hostEmail'], 
				'hostId': request.session['hostId'],
				'questions': questions
			}
		)
	# otherwise, redirect to login page with the Amazon button
	return render(request,"login.html")

# Call this after the user inputs Amazon credentials
def login(request):
	# retrieve access token appended by Amazon API
	access_token = request.GET.get('access_token', None)
	b = StringIO.StringIO()
 
	# verify that the access token belongs to us
	c = pycurl.Curl()
	c.setopt(pycurl.URL, "https://api.amazon.com/auth/o2/tokeninfo?access_token=" + urllib.quote_plus(access_token))
	c.setopt(pycurl.SSL_VERIFYPEER, 1)
	c.setopt(pycurl.WRITEFUNCTION, b.write)
	 
	c.perform()
	d = json.loads(b.getvalue())
	 
	if d['aud'] != '' :
	    # the access token does not belong to us
	    raise BaseException("Invalid Token")
	 
	# exchange the access token for user profile
	b = StringIO.StringIO()
	 
	c = pycurl.Curl()
	c.setopt(pycurl.URL, "https://api.amazon.com/user/profile")
	c.setopt(pycurl.HTTPHEADER, ["Authorization: bearer " + access_token])
	c.setopt(pycurl.SSL_VERIFYPEER, 1)
	c.setopt(pycurl.WRITEFUNCTION, b.write)
	 
	c.perform()
	d = json.loads(b.getvalue())
	 
	# save these 3 key attributes into our session
	request.session['hostName'] = d['name'].split(' ')[0]
	request.session['hostEmail'] = d['email']
	request.session['hostId'] = d['user_id']

	return HttpResponseRedirect('/index/')

# Call this if the user clicks the big Logout button in the top right of the navbar
def logout(request):
	# clear session if already logged in
	if request.session.has_key('hostName'):
		del request.session['hostName']
		del request.session['hostEmail']
		del request.session['hostId']
	# now log out
	return render(request,"login.html")

# Call this after the user submits the around-the-house form (via AJAX) 
def insertHouseQuestion(request):
	# check if logged in first
	if request.session.has_key('hostId'):
		table = dynamodb.Table("houseQuestions")
		# first we need to get a new unique numeric ID for this question
		response = table.scan()

		questions = response['Items']
		qId = 0
		if len(questions)>0:
			questions.sort(key=lambda q: int(q['qId']), reverse=True)
			# increment largest ID by one
			qId = int(questions[0]['qId']) + 1
		qType = request.POST.get('qType', None)
		subject = request.POST.get('subject', None)
		answer = request.POST.get('answer', None)
		userId = request.session['hostId']
		# try to insert into DynamoDB, then return AJAX response
		try:
		    table.put_item(
		        Item={ 
		        	'qId': qId, 
		        	'type': qType, 
		        	'subject': subject, 
		        	'answer': answer, 
		        	'userId': userId, 
		        	'category': 'House'
		        }
		    )
		    return HttpResponse(json.dumps({'status': "success", 'qId': qId}), content_type="application/json")
		except:
		    return HttpResponseBadRequest()
	# if not logged in, return fail
	return HttpResponseBadRequest()

def deleteQuestion(request):
	# check if logged in first
	if request.session.has_key('hostId'):
		table = dynamodb.Table("houseQuestions")
		# get question ID
		qId = int(request.POST.get('qId'))
		# try to insert into DynamoDB, then return AJAX response
		try:
		    table.delete_item(
			    Key={
			        'qId': qId,
			    }
			)
		    return HttpResponse(json.dumps({'status': "success"}), content_type="application/json")
		except:
		    return HttpResponseBadRequest()
	# if not logged in, return fail
	return HttpResponseBadRequest()

def retrieveAreaAnswers(request):
	if request.session.has_key('hostId'):
		table = dynamodb.Table("houseQuestions")
		# get category
		category = request.POST.get('category')
		# try to insert into DynamoDB, then return AJAX response
		try:
			response = table.scan(
				FilterExpression=Attr('category').eq(category) & Attr('userId').eq(request.session['hostId'])
			)
			answers = response['Items']
			for answer in answers:
				answer['qId'] = str(answer['qId'])
			answers.sort(key=lambda a: int(a['qId']), reverse=True)
			return HttpResponse(json.dumps({'status': "success", "answers": answers}), content_type="application/json")
		except:
		    return HttpResponseBadRequest()
	# if not logged in, return fail
	return HttpResponseBadRequest()

# Call this after the user submits the in-the-area form (via AJAX) 
def insertAreaAnswer(request):
	# check if logged in first
	if request.session.has_key('hostId'):
		table = dynamodb.Table("houseQuestions")
		# first we need to get a new unique numeric ID for this question
		response = table.scan()
		questions = response['Items']
		qId = 0
		if len(questions)>0:
			questions.sort(key=lambda q: int(q['qId']), reverse=True)
			# increment largest ID by one
			qId = int(questions[0]['qId']) + 1
		category = request.POST.get('category', None)
		subject = category.lower()
		placeName = request.POST.get('placeName', None)
		answer = placeName
		attr = request.POST.get('placeAttr', None)
		distance = request.POST.get('placeDistance', None)
		userId = request.session['hostId']
		# try to insert into DynamoDB, then return AJAX response
		try:
		    table.put_item(
		        Item={ 
		        	'qId': qId, 
		        	'placeName': placeName, 
		        	'attr': attr, 
		        	'subject': subject, 
		        	'answer': answer,
		        	'distance': distance, 
		        	'category': category,
		        	'userId': userId,
		        }
		    )
		    return HttpResponse(json.dumps({'status': "success", 'qId': qId}), content_type="application/json")
		except:
		    return HttpResponseBadRequest()
		
	# if not logged in, return fail
	return HttpResponseBadRequest()

def rearrange(request):
	# check if logged in first
	if request.session.has_key('hostId'):
		table = dynamodb.Table("houseQuestions")
		# get newly rearranged items
		items = json.loads(request.POST.get('items', None))
		for item in items:
			qId = item['qId']
			placeName = item['name']
			attr = item['attr']
			distance = item['distance']
			table.update_item(
				Key={ 
					'qId': int(qId),
				},
				UpdateExpression="set placeName = :placeName, attr = :attr, distance = :distance",
				ExpressionAttributeValues={
					':placeName': placeName,
					':attr': attr,
					':distance': distance,
				},
				ReturnValues="UPDATED_NEW"
			)
		return HttpResponse(json.dumps({'status': "success"}), content_type="application/json")
		
	# if not logged in, return fail
	return HttpResponseBadRequest()

def allQuestions(request):
	# check for login status
	if request.session.has_key('hostName'):
		table = dynamodb.Table('houseQuestions')
		houseResponse = table.scan(
			FilterExpression=Attr('category').eq('House') & Attr('userId').eq(request.session['hostId'])
		)
		areaResponse = table.scan(
			FilterExpression=Attr('category').ne('House') & Attr('userId').eq(request.session['hostId'])
		)
		
		houseQuestions = houseResponse['Items']
		areaQuestions = areaResponse['Items']
		
		houseQuestions.sort(key=lambda q: int(q['qId']), reverse=True)
		areaQuestions.sort(key=lambda q: int(q['qId']), reverse=True)

		return render(
			request,
			"allQuestions.html",
			context={
				'hostName': request.session['hostName'],
				'hostEmail': request.session['hostEmail'], 
				'hostId': request.session['hostId'],
				'houseQuestions': houseQuestions,
				'areaQuestions': areaQuestions
			}
		)
	# otherwise, redirect to login page with the Amazon button
	return render(request,"login.html")

def help(request):
	# check for login status
	if request.session.has_key('hostName'):
		return render(
			request,
			"help.html",
			context={
				'hostName': request.session['hostName'],
				'hostEmail': request.session['hostEmail'], 
				'hostId': request.session['hostId']
			}
		)
	# otherwise, redirect to login page with the Amazon button
	return render(request,"login.html")

def editHouseQuestion(request):
	# check if logged in first
	if request.session.has_key('hostId'):
		table = dynamodb.Table("houseQuestions")
		# get question ID
		qId = int(request.POST.get('qId'))
		table.update_item(
			Key={ 
				'qId': int(qId),
			},
			UpdateExpression="set #qType = :type, subject = :subject, answer = :answer",
			ExpressionAttributeNames={
				'#qType': 'type',
			},
			ExpressionAttributeValues={
				':type': request.POST.get('qType'),
				':subject': request.POST.get('subject'),
				':answer': request.POST.get('answer'),
			},
			ReturnValues="UPDATED_NEW"
		)
		return HttpResponse(json.dumps({'status': "success", 'qId': qId}), content_type="application/json")
		
	# if not logged in, return fail
	return HttpResponseBadRequest()

def getDetails(request):
	# check if logged in first
	if request.session.has_key('hostId'):
		table = dynamodb.Table("houseQuestions")
		# get question ID
		qId = int(request.POST.get('qId'))

		response = table.scan(
				FilterExpression=Key('qId').eq(qId)
			)
		question = response['Items'][0]
		
		# return details
		try:
			details = {
				'status': "success",
				'type': question['type'], 
				'subject': question['subject'], 
				'answer': question['answer'], 
		    }
			return HttpResponse(json.dumps(details), content_type="application/json")
		except:
			return HttpResponseBadRequest()
		
	# if not logged in, return fail
	return HttpResponseBadRequest()
