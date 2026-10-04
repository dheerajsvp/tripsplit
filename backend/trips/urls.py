from django.urls import path

from . import views

urlpatterns = [
    path("groups/", views.GroupListCreateView.as_view(), name="group-list-create"),
    path("groups/<str:share_code>/", views.GroupDetailView.as_view(), name="group-detail"),
    path(
        "groups/<str:share_code>/members/",
        views.MemberListCreateView.as_view(),
        name="member-list-create",
    ),
    path(
        "groups/<str:share_code>/expenses/",
        views.ExpenseListCreateView.as_view(),
        name="expense-list-create",
    ),
    path(
        "groups/<str:share_code>/expenses/<int:expense_id>/",
        views.ExpenseDetailView.as_view(),
        name="expense-detail",
    ),
    path(
        "groups/<str:share_code>/settlements/",
        views.SettlementListCreateView.as_view(),
        name="settlement-list-create",
    ),
    path("groups/<str:share_code>/balances/", views.BalancesView.as_view(), name="group-balances"),
]
