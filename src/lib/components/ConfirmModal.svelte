<script lang="ts">
  // The yes/no modal upstream repeats inline on several pages.
  let {
    title,
    text,
    yes,
    no,
    onyes,
    onclose
  }: { title: string; text: string; yes: string; no: string; onyes: () => void; onclose: () => void } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-[calc(100%-1rem)] max-h-full bg-black bg-opacity-25" onclick={onclose}>
  <div class="modal-container relative p-4 w-full max-w-md max-h-full rounded-lg shadow" onclick={(e) => e.stopPropagation()}>
    <div class="modal-container relative rounded-lg shadow">
      <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
        <h3 class="text-xl font-semibold">{title}</h3>
        <button
          onclick={onclose}
          class="end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
          aria-label="Close"
        >
          <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
          </svg>
        </button>
      </div>
      <div class="p-4 md:p-5">
        <p class="block mb-2 text-sm font-medium">{text}</p>
        <div class="flex justify-between space-x-4">
          <button
            onclick={() => {
              onclose();
              onyes();
            }}
            class="mt-4 download-button font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">{yes}</button
          >
          <button onclick={onclose} class="mt-4 download-button font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">{no}</button>
        </div>
      </div>
    </div>
  </div>
</div>
