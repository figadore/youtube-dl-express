
$(function () {
  results = $("#status");

  console.log("Here is the script")
  $("form").submit(function (e) {
    if (e.preventDefault) e.preventDefault();
    let urlOrId = $("#urlOrId").val()
    let author = $("#author").val()
    let title = $("#title").val()
    let filename = $("#filename").val()
    $.ajax({
      url: "/queue",
      type: "POST",
      data: JSON.stringify({ urlOrId, author, title, filename }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
      success: onEnqueue,
      failure: (err) => {
        console.log({ err });
        results.text("Something went wrong while attempting to add this item to the queue");
      }
    });
    return false;
  });

  $("#results-btn").click(() => {
    $.ajax({
      url: "/results",
      type: "GET",
      dataType: "json",
      success: (data) => {
        console.log({ data });
        results.text("")
        if (data.queue.length) {
          results.append(`Queue:<br />`)
          data.queue.forEach((val, i) => {
            results.append(`${val.urlOrId}: ${val.author}/${val.title}/${val.filename}<br />`)
          })
        }
        if (data.successes.length) {
          results.append(`Successes:<br />`)
          data.successes.forEach((val, i) => {
            results.append(`${val.urlOrId}: ${val.author}/${val.title}/${val.filename}<br />`)
          })
        }
        if (data.failures.length) {
          results.append(`Failures:<br />`)
          data.failures.forEach((val, i) => {
            results.append(`${val.urlOrId}: ${val.author}/${val.title}/${val.filename} - ${val.error}<br />`)
          })
        }
      },
      failure: (err) => {
        console.log({ err });
        results.text("Something went wrong while attempting to get the results");
      }
    });
  })

  function onEnqueue(data) {
    console.log("onEnqueue:", { data })
    results.text(`Success: Added ${data.item.author}/${data.item.title}/${data.item.filename} to the download queue`)
    setTimeout(() => {
      results.text("")
    }, 4000);
  }
});
