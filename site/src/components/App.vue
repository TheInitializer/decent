<template>
	<div id="app">
		<server-sidebar :user="user"></server-sidebar>
	</div>
</template>

<script>
let Vue = require('vue');
Vue.component('server-sidebar', require('./ServerSidebar.vue'));
Vue.use(require('vue-async-computed'));

export default {
	data() {
		return {
			sessionID: '80c0d1a0-63f0-4234-ae69-1b4ee7a3c29b'
		}
	},
	asyncComputed: {
		user() {
			// Whenever sessionID changes, update 'user' accordingly
			return fetch(`/api/session/${this.sessionID}`)
				.then(res => res.json())
				.then(res => res.user)
				.then(user => Object.assign(user, {sessionID: this.sessionID}));
		}
	}
}
</script>

<style scoped>
#app {
	width: 100%;
	height: 100%;

	display: flex;
	align-items: stretch;
}
</style>
