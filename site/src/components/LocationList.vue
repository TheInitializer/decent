<template>
	<div class="location-list">
		<a href="#"
			v-for="item in items"
			class="list-item"
			:class="[type, (item.unreadMessageCount > 0) ? 'notification' : '']">{{ item.name }}</a>
	</div>
</template>

<script>
export default {
	props: ['items', 'type']
}
</script>

<style scoped>
.location-list {
	display: flex;
	flex-direction: column;
	margin: 8px 16px;
}
.list-item {
	display: flex;
	position: relative;

	align-items: center;
	padding: 8px 16px;
	margin-bottom: 4px;

	font-family: 'Noto Sans', sans-serif;
	font-size: 16px;
	font-weight: normal;
	color: var(--gray-100);
	text-decoration: none;

	border-radius: 4px;
}
.list-item:hover {
	background: var(--gray-700);
}
.list-item.active {
	background: var(--blue);
	color: var(--gray-900);
}
.channel::before {
	display: inline;
	content: '#';

	margin-right: 8px;
	margin-left: -4px;

	font-weight: bold;
	color: var(--gray-500);
}
.channel.active::before {
	color: #afceff;
}
.settings::before {
	display: inline-block;
	content: ' ';

	width: 16px;
	height: 16px;
	margin-right: 8px;
	margin-left: -4px;

	background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMTYiIHdpZHRoPSIxNiIgdmVyc2lvbj0iMS4xIiB2aWV3Qm94PSIwIDAgNC4yMzMzMzMyIDQuMjMzMzMzNSI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCAtMjkyLjc3KSI+PHBhdGggc3R5bGU9InBhaW50LW9yZGVyOm5vcm1hbCIgZD0ibTcgMGwtMC41NTA4IDIuMjA3YTYgNiAwIDAgMCAtMS40NDUzIDAuNjAzNWwtMS45NTMxLTEuMTczOC0xLjQxNDEgMS40MTQxIDEuMTcxOSAxLjk1MTJhNiA2IDAgMCAwIC0wLjU5NzcgMS40NDUzbC0yLjIxMDkgMC41NTI3djJsMi4yMDcgMC41NTA4YTYgNiAwIDAgMCAwLjYwMzUgMS40NDUybC0xLjE3MzggMS45NTMgMS40MTQxIDEuNDE0IDEuOTUxMi0xLjE3MmE2IDYgMCAwIDAgMS40NDUzIDAuNTk4bDAuNTUyNyAyLjIxMWgybDAuNTUwOC0yLjIwN2E2IDYgMCAwIDAgMS40NDUyIC0wLjYwNGwxLjk1MyAxLjE3NCAxLjQxNC0xLjQxNC0xLjE3Mi0xLjk1MWE2IDYgMCAwIDAgMC41OTggLTEuNDQ1M2wyLjIxMS0wLjU1Mjd2LTJsLTIuMjA3LTAuNTUwOGE2IDYgMCAwIDAgLTAuNjA0IC0xLjQ0NTNsMS4xNzQtMS45NTMxLTEuNDE0LTEuNDE0MS0xLjk1MSAxLjE3MTlhNiA2IDAgMCAwIC0xLjQ0NTMgLTAuNTk3N2wtMC41NTI3LTIuMjEwOWgtMnptMSA1YTMgMyAwIDAgMSAzIDMgMyAzIDAgMCAxIC0zIDMgMyAzIDAgMCAxIC0zIC0zIDMgMyAwIDAgMSAzIC0zeiIgdHJhbnNmb3JtPSJtYXRyaXgoLjI2NDU4IDAgMCAuMjY0NTggMCAyOTIuNzcpIiBmaWxsPSIjY2RkMWQ3Ii8+PC9nPjwvc3ZnPgo=');
}
.notification::after {
  display: block;
  content: ' ';

  position: absolute;
  top: 9px;
  left: 18px;
  width: 6px;
  height: 6px;

  border-radius: 99px;
  background: var(--red);
  border: 2px solid var(--gray-900);
}
.notification:hover::after {
  border-color: var(--gray-700);
}
.notification.active::after {
  border-color: var(--blue);
}
</style>
