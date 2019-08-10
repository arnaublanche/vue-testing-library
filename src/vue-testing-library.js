import { createLocalVue, mount } from '@vue/test-utils'

import {
  getQueriesForElement,
  prettyDOM,
  wait,
  fireEvent as dtlFireEvent
} from '@testing-library/dom'

const mountedWrappers = new Set()

function render(
  TestComponent,
  { store = null, routes = null, ...mountOptions } = {},
  configurationCb
) {
  const localVue = createLocalVue()
  let vuexStore = null
  let router = null
  let additionalOptions = {}

  if (store) {
    const Vuex = require('vuex')
    localVue.use(Vuex)
    vuexStore = new Vuex.Store(store)
  }

  if (routes) {
    const VueRouter = require('vue-router')
    localVue.use(VueRouter)
    router = new VueRouter({
      routes
    })
  }

  if (configurationCb && typeof configurationCb === 'function') {
    additionalOptions = configurationCb(localVue, vuexStore, router)
  }

  if (!mountOptions.propsData && !!mountOptions.props) {
    mountOptions.propsData = mountOptions.props
    delete mountOptions.props
  }

  const wrapper = mount(TestComponent, {
    localVue,
    router,
    store: vuexStore,
    attachToDocument: true,
    sync: false,
    ...mountOptions,
    ...additionalOptions
  })

  mountedWrappers.add(wrapper)

  if (wrapper.element.parentNode === document.body) {
    const div = document.createElement('div')
    wrapper.element.parentNode.insertBefore(div, wrapper.element)
    div.appendChild(wrapper.element)
  }

  return {
    container: wrapper.element.parentNode,
    baseElement: document.body,
    debug: (el = wrapper.element) => console.log(prettyDOM(el)),
    unmount: () => wrapper.destroy(),
    isUnmounted: () => wrapper.vm._isDestroyed,
    html: () => wrapper.html(),
    emitted: () => wrapper.emitted(),
    updateProps: _ => {
      wrapper.setProps(_)
      return wait()
    },
    ...getQueriesForElement(wrapper.element.parentNode)
  }
}

function cleanup() {
  mountedWrappers.forEach(cleanupAtWrapper)
}

function cleanupAtWrapper(wrapper) {
  if (
    wrapper.element.parentNode &&
    wrapper.element.parentNode.parentNode === document.body
  ) {
    document.body.removeChild(wrapper.element.parentNode)
  }
  wrapper.destroy()
  mountedWrappers.delete(wrapper)
}

// Vue Testing Library's version of fireEvent will call DOM Testing Library's
// version of fireEvent plus wait for one tick of the event loop so that...
async function fireEvent(...args) {
  dtlFireEvent(...args)
  await wait()
}

Object.keys(dtlFireEvent).forEach(key => {
  fireEvent[key] = async (...args) => {
    dtlFireEvent[key](...args)
    await wait()
  }
})

fireEvent.touch = async elem => {
  await fireEvent.focus(elem)
  await fireEvent.blur(elem)
}

// Small utility to provide a better experience when working with v-model.
// Related upstream issue: https://github.com/vuejs/vue-test-utils/issues/345#issuecomment-380588199
// Examples: https://github.com/testing-library/vue-testing-library/blob/master/tests/__tests__/form.js
fireEvent.update = async (elem, value) => {
  const tagName = elem.tagName
  const type = elem.type

  switch (tagName) {
    case 'OPTION': {
      elem.selected = true

      const parentSelectElement =
        elem.parentElement.tagName === 'OPTGROUP'
          ? elem.parentElement.parentElement
          : elem.parentElement

      return fireEvent.change(parentSelectElement)
    }

    case 'INPUT': {
      if (['checkbox', 'radio'].includes(type)) {
        elem.checked = true
        return fireEvent.change(elem)
      } else {
        elem.value = value
        return fireEvent.input(elem)
      }
    }

    case 'TEXTAREA': {
      elem.value = value
      return fireEvent.input(elem)
    }

    case 'SELECT': {
      elem.value = value
      return fireEvent.change(elem)
    }
  }
}

export * from '@testing-library/dom'
export { cleanup, render, fireEvent }
