var editMode = -1;

function getCookie(name) {
	var cookieValue = null;
	if (document.cookie && document.cookie !== '') {
		var cookies = document.cookie.split(';');
		for (var i = 0; i < cookies.length; i++) {
			var cookie = jQuery.trim(cookies[i]);
			// Does this cookie string begin with the name we want?
			if (cookie.substring(0, name.length + 1) === (name + '=')) {
				cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
				break;
			}
		}
	}
	return cookieValue;
}
function csrfSafeMethod(method) {
	// these HTTP methods do not require CSRF protection
	return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

$(function(){
	var csrftoken = getCookie('csrftoken');
	var alertSuccess = "<div class='alert alert-success'><a href='#' class='close' data-dismiss='alert' aria-label='close'>&times;</a><strong>";
    var alertWarning = "<div class='alert alert-warning'><a href='#' class='close' data-dismiss='alert' aria-label='close'>&times;</a><strong>";

    // click the Edit icon in the table for around-the-house
    $(document).on("click", '.editField',function(){
        var id = $(this).attr('id').split('_')[1];
        editMode = id;
        $.ajaxSetup({
            beforeSend: function(xhr, settings) {
                if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                    xhr.setRequestHeader("X-CSRFToken", csrftoken);
                }
            }
        });
        $.post("/getDetails/", {qId: id}, function(data, status){
            if (status=="success") {
                // edit house modal temporarily
                $('#houseForm').attr('action','/editHouseQuestion/');
                $('#qType').val(data.type);
                $('#subject').val(data.subject);
                $('#answer').val(data.answer);
                $('#houseqId').val(id);
                $("#houseModal .modal-title").html("Edit Question");
                $('#houseModal').modal();
            } else {
                console.log("error");
            }
        });
    });

    // Click the X in the table for around-the-house
    $(document).on("click", 'a[id*="delete"]',function(){
    	var id = $(this).attr('id').split('_')[1];
    	$( "#confirmDelete" ).dialog({
			resizable: false,
			height: "auto",
			width: 400,
			modal: true,
			buttons: {
				"Yes": function() {
					$.ajaxSetup({
						beforeSend: function(xhr, settings) {
							if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
								xhr.setRequestHeader("X-CSRFToken", csrftoken);
							}
						}
					});
					$.post("/deleteQuestion/", {qId: id}, function(data, status){
				        if (status=="success") {
				        	$("#delete_"+id).parent().parent().remove();
				        } else {
				        	console.log("error");
				        }
				    });
					$( this ).dialog( "close" );
				},
				No: function() {
					$( this ).dialog( "close" );
				}
			}
		});
	
	});

	// Submit a new around the house question (or edit an existing one)
	$("#houseForm").submit(function(e){
        e.preventDefault(); //STOP default action
        // input validation
        if ($("#answer").val()=="") {
            $("#alertRow1").html(alertWarning+"You need an answer!</strong></div>");
            return;
        }
        if ($("#subject").val()=="") {
            $("#alertRow1").html(alertWarning+"You need a subject!</strong></div>");
            return;
        }
        var formURL = $(this).attr('action');
        var formData = new FormData(this);
        $.ajax({
            url : formURL,
            method: "POST",
            data : formData,
            processData: false,
            contentType: false,
            success:function(data, textStatus, jqXHR) {
        		$("#alertRow1").html(alertSuccess+"Your question was saved.</strong></div>");
                var newRow = "<td>" + $('#qType').val() + " " + $('#subject').val() + "?</td>";
                newRow += "<td>" + $('#answer').val() + "</td>";
                newRow += "<td>";
                newRow += "<a href='#' id='delete_"+data.qId+"'><i class='material-icons' style='float:right;'>close</i></a>";
                newRow += "<span id='editHouse_"+data.qId+"' class='editField glyphicon glyphicon-edit' style='float:right;'></span></td>";

                if (editMode>-1) {
                    $('#delete_'+editMode).parent().parent().html(newRow);                    
                } else {
                    $('#houseTableBody').prepend("<tr>"+newRow+"</tr>");
                }
                
                $("#answer").val("");
                $("#subject").val("");
            },
            error: function(jqXHR, textStatus, errorThrown) {
                $("#alertRow1").html(alertWarning+"There was a problem saving your question. Please refresh and try again.</strong></div>");   
            }
        });
        e.preventDefault(); //STOP default action
    });

    // if in edit mode, reset the houseModal to insert mode
    $('#houseModal').on('hidden.bs.modal', function () {
        if (editMode>-1){
            editMode = -1;
            $('#houseForm').attr('action','/insertHouseQuestion/');
            $("#houseModal .modal-title").html("New Question");
            $("#qType").val("What is");
            $("#answer").val("");
            $("#subject").val("");
        }
        $("#alertRow1").html("");
    })

    // when closing the in-the-area modal, remove the notification
    $("#areaModal").on("hidden.bs.modal", function () {
        $("#alertRow2").html("");
    });

    // in-the-area modal top form
    $("#areaForm").submit(function(e){
        e.preventDefault(); //STOP default action
        // input validation
        if ($("#placeName").val()=="") {
            $("#alertRow2").html(alertWarning+"You need a name!</strong></div>");
            return;
        }
        if ($("#placeAttr").val()=="") {
            $("#alertRow2").html(alertWarning+"You need to specify the "+$('#attrLabel').html()+"!</strong></div>");
            return;
        }
        if ($("#placeDistance").val()=="") {
            $("#alertRow2").html(alertWarning+"You need to indicate the distance!</strong></div>");
            return;
        }
        var formURL = $(this).attr('action');
        var formData = new FormData(this);
        $.ajax({
            url : formURL,
            method: "POST",
            data : formData,
            processData: false,
            contentType: false,
            success:function(data, textStatus, jqXHR) {
        		$("#alertRow2").html(alertSuccess+"Your answer was inserted.</strong></div>");
                var newRow = "<tr>";
                newRow += "<td>" + $('#placeName').val() + "</td>";
                newRow += "<td>" + $('#placeAttr').val() + "</td>";
                newRow += "<td>" + $('#placeDistance').val() + " miles</td>";
                newRow += "<td><a href='#' id='delete_"+data.qId+"'><i class='material-icons' style='float:right;'>close</i></a></td>";
                newRow += "</tr>";
                $('#sortable').prepend(newRow);
                $("#placeName").val("");
                $("#placeAttr").val("");
                $("#placeDistance").val("");
            },
            error: function(jqXHR, textStatus, errorThrown) {
                $("#alertRow2").html(alertWarning+"There was a problem inserting your answer. Please refresh and try again.</strong></div>");   
            }
        });
        e.preventDefault(); //STOP default action
    });

    // draggable rows in the in-the-area modals
    $("#sortable").sortable({
    	beforeStop: function (event, ui) {
    		var qIds = [];
    		var list = [];
    		$("#sortable tr").each(function(index){
    			var tmp = ""+$(this).find('a').attr('id');
    			var id = parseInt(tmp.split('_')[1]);
    			if (!isNaN(id)) {
    				qIds.push(parseInt(id));
    				var obj = {
	    				qId: id,
	    				name: $(this).children().eq(0).html(),
	    				attr: $(this).children().eq(1).html(),
	    				distance: $(this).children().eq(2).html().split(" ")[0]
	    			}
	    			list.push(obj)
    			}
    		});
    		qIds = qIds.sort(function (a, b) {  return b-a;  });
    		for (var i=0; i<qIds.length;i++){
    			list[i].qId = qIds[i];
    			$("#sortable tr td a").eq(i).attr('id','delete_'+qIds[i])
    		}
    		$.post("/rearrange/", {items: JSON.stringify(list)}, function(data, status){
		        if (status=="success") {
		        	console.log("success!");
		        } else {
		        	console.log("error");
		        }
		    });
    	}
    });
    $("#sortable").disableSelection();
});

function showAreaModal(type){
	// put title on modal
	$("#areaModal .modal-title").html(type);
	$('#category').val(type);
	// clear sortable table so we can refill it
	$('#sortable').html("");
	// populate the headers of the table
	if (type=="Breakfast" || type=="Lunch" || type=="Dinner"){
		$("#attrLabel").html("Cuisine");
		$('#areaTableHead').html("<th>Name</th><th>Cuisine</th><th>Distance</th><th></th>")
	} else if (type=="Bars" || type=="Grocery Stores" || type=="Attractions" ) {
		$("#attrLabel").html("Type");
		$('#areaTableHead').html("<th>Name</th><th>Type </th><th>Distance</th><th></th>")
	}

	var csrftoken = getCookie('csrftoken');
	$.ajaxSetup({
		beforeSend: function(xhr, settings) {
			if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
				xhr.setRequestHeader("X-CSRFToken", csrftoken);
			}
		}
	});
	$.post("/retrieveAreaAnswers/", {category: type}, function(data, status){
        if (status=="success") {
        	for (var i=0; i<data.answers.length;i++){
        		answer = data.answers[i];

        		var newRow = "<tr>";
                newRow += "<td>" + answer.placeName + "</td>";
				newRow += "<td>" + answer.attr + "</td>";
                newRow += "<td>" + answer.distance + " miles</td>";
                newRow += "<td><a href='#' id='delete_"+answer.qId+"'><i class='material-icons' style='float:right;'>close</i></a></td>";
                newRow += "</tr>";
                $('#sortable').append(newRow);
        	}
        } else {
        	console.log("error");
        }
    });
	$("#areaModal").modal();
}