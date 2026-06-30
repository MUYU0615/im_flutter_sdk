part of '../client_web.dart';

class ContactManagerWeb extends ContactManager {
  Future<dynamic> Function(MethodCall call)? _handler;
  final Map<String, Map<String, dynamic>> _contacts = {};
  final Set<String> _blockList = {};

  @override
  void updateNativeHandler(handler) {
    _handler = handler;
  }

  @override
  Future<dynamic> callNativeMethod(String method, [dynamic params]) async {
    final map = _asMap(params);
    final client = Client.instance;
    final realSdk =
        client is ClientWeb && client._sdkMode == 'real_sdk'
            ? client._realSdk
            : null;
    switch (method) {
      case _MethodKeys.addContact:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.addContact(userId, map['reason']?.toString());
          return {method: userId};
        }
        _contacts.putIfAbsent(userId, () => {'userId': userId});
        return {method: userId};
      case _MethodKeys.deleteContact:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.deleteContact(userId);
          return {method: userId};
        }
        _contacts.remove(userId);
        return {method: userId};
      case _MethodKeys.getAllContactsFromServer:
        if (realSdk != null) {
          return {method: await realSdk.getContactIds()};
        }
        return {method: _contactIds()};
      case _MethodKeys.getAllContactsFromDB:
        return {method: _contactIds()};
      case _MethodKeys.getAllContacts:
      case _MethodKeys.fetchAllContacts:
        if (realSdk != null) {
          return {method: await realSdk.getContacts()};
        }
        return {method: _contactList()};
      case _MethodKeys.fetchContacts:
        if (realSdk != null) {
          return {
            method: await realSdk.getContactsWithCursor(
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _fetchContacts(map)};
      case _MethodKeys.fetchAllContactIds:
      case _MethodKeys.getAllContactIds:
        if (realSdk != null) {
          return {method: await realSdk.getContactIds()};
        }
        return {method: _contactIds()};
      case _MethodKeys.setContactRemark:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.setContactRemark(
            userId: userId,
            remark: map['remark']?.toString() ?? '',
          );
          return {method: true};
        }
        final contact = _contacts.putIfAbsent(userId, () => {'userId': userId});
        contact['remark'] = map['remark']?.toString() ?? '';
        return {method: true};
      case _MethodKeys.getContact:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          final contacts = await realSdk.getContacts();
          for (final contact in contacts) {
            if (contact['userId']?.toString() == userId) {
              return {method: contact};
            }
          }
          return {method: null};
        }
        final contact = _contacts[userId];
        return {
          method: contact == null ? null : Map<String, dynamic>.from(contact),
        };
      case _MethodKeys.addUserToBlockList:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.addUserToBlockList(userId);
          return {method: userId};
        }
        _blockList.add(userId);
        return {method: userId};
      case _MethodKeys.removeUserFromBlockList:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.removeUserFromBlockList(userId);
          return {method: userId};
        }
        _blockList.remove(userId);
        return {method: userId};
      case _MethodKeys.getBlockListFromServer:
        if (realSdk != null) {
          return {method: await realSdk.getBlockList()};
        }
        return {method: _blockList.toList()..sort()};
      case _MethodKeys.getBlockListFromDB:
        return {method: _blockList.toList()..sort()};
      case _MethodKeys.acceptInvitation:
        if (realSdk != null) {
          await realSdk.acceptInvitation(map['userId']?.toString() ?? '');
          return {method: true};
        }
        return {method: true};
      case _MethodKeys.declineInvitation:
        if (realSdk != null) {
          await realSdk.declineInvitation(map['userId']?.toString() ?? '');
          return {method: true};
        }
        return {method: true};
      case _MethodKeys.getSelfIdsOnOtherPlatform:
        return {method: <String>[]};
      default:
        return _unsupported('ContactManager', method);
    }
  }

  Future<void> emitContactEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  void reset() {
    _contacts.clear();
    _blockList.clear();
  }

  List<String> _contactIds() => _contacts.keys.toList()..sort();

  List<Map<String, dynamic>> _contactList() {
    return _contactIds()
        .map((userId) => Map<String, dynamic>.from(_contacts[userId]!))
        .toList();
  }

  Map<String, dynamic> _fetchContacts(Map<String, dynamic> map) {
    return _fetchContactPage(map, _contactList());
  }

  Map<String, dynamic> _fetchContactPage(
    Map<String, dynamic> map,
    List<Map<String, dynamic>> contacts,
  ) {
    final pageSize =
        int.tryParse(map['pageSize']?.toString() ?? '') ?? contacts.length;
    final cursor = map['cursor']?.toString() ?? '';
    final start = int.tryParse(cursor) ?? 0;
    final end = (start + pageSize).clamp(start, contacts.length);
    final nextCursor = end >= contacts.length ? '' : end.toString();
    return {
      'cursor': nextCursor,
      'list': contacts.sublist(start, end),
    };
  }
}
