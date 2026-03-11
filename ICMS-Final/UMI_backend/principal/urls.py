from django.urls import path
from . import views
from .views import delete_principal
urlpatterns = [

    path("principal/create/", views.create_principal),

    path("principal/", views.list_principals),

    path("principal/activate/<int:id>/", views.activate_principal),

    path("principal/deactivate/<int:id>/", views.deactivate_principal),
    
    path("principal/update/<int:id>/", views.update_principal),

    path("principal/delete/<int:pk>/", delete_principal.as_view(),name="delete_principal"),
    
]