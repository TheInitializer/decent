<template>
	<div id="server-sidebar">
		<div class="sidebar-section sidebar-section-server">
			<sidebar-subtitle
				title="Server"
				buttonText="+ Add"></sidebar-subtitle>
			<div class="server-dropdown">
				<!-- server-dropdown should really be its own component. -->
				<div class="server-dropdown-current">servername.com</div>
				<div class="server-dropdown-panel">
					<div v-for="server in 5"
					class="server-dropdown-option">example{{ server }}.com</div>
				</div>
			</div>
			<div class="user-info">
				<!-- logged in -->
				<div v-if="true" class="user-info-text">Logged in as <a href="#" class="user-info-name">{{ user.username }}</a></div>
				<button v-if="true" @click="account.loggedIn = false" class="user-info-button">Log out</button>

				<!-- logged out -->
				<!--
				<div v-if="!account.loggedIn" class="user-info-text">Logged out</div>
				<button v-if="!account.loggedIn" class="user-info-button">Register</button>
				<button v-if="!account.loggedIn" @click="account.loggedIn = true" class="user-info-button user-info-button-minor">Log in</button>
				-->
			</div>
		</div>
		<div class="sidebar-section">
			<sidebar-subtitle
				title="Channels"
				:showButton="user.permissionLevel === 'admin'"
				buttonText="+ Add"></sidebar-subtitle>
				<location-list
					:items="channels"
					type="channel"></location-list>
			</div>
		</div>
	</div>
</template>

<script>
let Vue = require('vue');
Vue.component('sidebar-subtitle', require('./SidebarSubtitle.vue'));
Vue.component('location-list', require('./LocationList.vue'));

export default {
	props: ['user'],
	data() {
		return {
			channels: []
		}
	},
	watch: {
		user: function () {
			// When user changes, update channel list
			fetch(`/api/channel-list?sessionID=${this.user.sessionID}`)
				.then(res => res.json())
				.then(res => { this.channels = res.channels });
		}
	}
}
</script>

<style scoped>
#server-sidebar {
	flex: 0 0 300px;
	overflow-y: auto;

	background: var(--gray-900);
  border-top: 6px solid var(--blue);
	border-right: 1px solid var(--gray-500);

  -webkit-touch-callout: none; /* iOS Safari */
	  -webkit-user-select: none; /* Safari */
	   -khtml-user-select: none; /* Konqueror HTML */
	     -moz-user-select: none; /* Firefox */
	      -ms-user-select: none; /* Internet Explorer/Edge */
	          user-select: none; /* Non-prefixed version, currently
	                                supported by Chrome and Opera */
}
.list-item {
	display: block;
}
</style>
