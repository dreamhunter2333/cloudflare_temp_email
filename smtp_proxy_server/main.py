import logging
import multiprocessing

from smtp_server import start_smtp_server
from imap_server import start_imap_server
from config import settings

_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)

if __name__ == '__main__':
    _logger.info(f"Starting server settings[{settings}]")
    process_list = [
        multiprocessing.Process(target=start_smtp_server, args=()),
        multiprocessing.Process(target=start_imap_server, args=()),
    ]
    try:
        for p in process_list:
            p.start()
        for p in process_list:
            p.join()
    except KeyboardInterrupt:
        for p in process_list:
            p.terminate()
