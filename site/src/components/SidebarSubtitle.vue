<template>
	<div class="sidebar-subtitle">
		<h4>{{ title }}</h4>
		<div v-if="showButton"
			@click="buttonAction"
			class="sidebar-subtitle-button">{{ buttonText }}</div>
	</div>
</template>

<script>
export default {
	props: ['title', 'buttonText', 'buttonAction', 'showButton']
}
</script>

<style scoped>
.sidebar-subtitle {
	display: flex;
	position: relative;

	align-items: center;
	margin: 16px;
	margin-bottom: 4px;

	z-index: 10;
}
h4 {
	font-family: 'Noto Sans', sans-serif;
	font-size: 14px;
	font-weight: bold;
	text-transform: uppercase;
	color: var(--gray-300);

	margin: 0;
}
.sidebar-subtitle-button {
	margin-left: auto;
	padding: 4px 8px;

	font-family: 'Noto Sans', sans-serif;
	font-size: 12px;
	color: var(--green);

	background: var(--green-a2);
	border-radius: 4px;

	cursor: pointer;
}
</style>
