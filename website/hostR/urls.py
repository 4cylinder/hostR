"""hostR URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.10/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  url(r'^$', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  url(r'^$', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.conf.urls import url, include
    2. Add a URL to urlpatterns:  url(r'^blog/', include('blog.urls'))
"""
from django.conf.urls import url
from django.contrib import admin
from hostR import views
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
	url(r'^admin/', admin.site.urls),
    url(r'^$', views.index, name='index'),
    url(r'^index/$', views.index, name='index'),
    url(r'^login/$', views.login, name='login'),
    url(r'^logout/$', views.logout, name='logout'),
    url(r'^deleteQuestion/$', views.deleteQuestion, name='deleteQuestion'),
    url(r'^insertHouseQuestion/$', views.insertHouseQuestion, name='insertHouseQuestion'),
    url(r'^insertAreaAnswer/$', views.insertAreaAnswer, name='insertAreaAnswer'),
    url(r'^retrieveAreaAnswers/$', views.retrieveAreaAnswers, name='retrieveAreaAnswers'),
    url(r'^rearrange/$', views.rearrange, name='rearrange'),
    url(r'^allQuestions/$', views.allQuestions, name='allQuestions'),
    url(r'^help/$', views.help, name='help'),
    url(r'^editHouseQuestion/$', views.editHouseQuestion, name='editHouseQuestion'),
    url(r'^getDetails/$', views.getDetails, name='getDetails'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)