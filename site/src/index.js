/*

So... Vue didn't really work out. I (PullJosh) am stopping here, but am pushing
to Github just for fun. Anybody who wants to peruse the code is free to.

A few notes:
- Right now my components' HTML and CSS are sort of a debacle. I was mostly just
  copying and pasting. It could be better with a bit of work. That's NOT why I
  am feeling bad about Vue.
- Vue's templating is GREAT imo. (See /components) I love the separation of concerns
  not by language, but by component. Each .vue file contains some HTML, CSS, and
  JS for a single component. The CSS can be scoped (really nice!), and the JS
  can contain state ("data") or methods particular to that component. That's all
  well and good.
- Vue's state management, on the other hand, is miserable to use. Maybe I'm
  doing something wrong, but the fact that you have to pass everything from
  parent components to their children as *properties* is bizarre to me. All the
  state of a parent element should be accessible by children. As it currently
  stands, global information (like the current server, user/session, current
  channel, etc) all needs to be passed down to every individual component that
  wants to access it. Really strange.
- Sorry for the tabs rather than spaces.

*/

let Vue = require('vue');

Vue.component('app', require('./components/App.vue'));
let vm = new Vue({
	el: '#app',
	template: '<app/>'
});
