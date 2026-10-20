use super::*;

#[test]
fn deleted_rows_are_filtered_before_remote_catalog_page_limit() {
    let (_directory, mut store, mut receiver, _peer) = setup();
    let mut ids = Vec::new();
    for i in 1..=40 {
        ids.push(receive(
            &mut store,
            &mut receiver,
            upload(i, i, "v1", "one.txt", b"safe"),
            b"safe",
        ));
    }
    ids.sort();
    for id in &ids[..32] {
        actions::change(&mut store, id, false, 1000).unwrap();
    }
    let Response::List(visible) =
        run(&mut receiver, &mut store, Request::List { after: None }).unwrap()
    else {
        panic!("list expected");
    };
    assert_eq!(
        visible.iter().map(|op| op.id.clone()).collect::<Vec<_>>(),
        ids[32..]
    );
    assert!(matches!(
        run(
            &mut receiver,
            &mut store,
            Request::Status { id: ids[0].clone() }
        ),
        Err(Error::OwnerDeleted)
    ));
}
